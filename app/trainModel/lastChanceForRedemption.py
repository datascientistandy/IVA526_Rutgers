from sklearn.ensemble import RandomForestRegressor
from sklearn.metrics import mean_absolute_error
import pandas as pd
import os
import joblib
import srtm
from datetime import timedelta
from meteostat import Daily, Stations
from datetime import datetime, timedelta


import trainModel.regionfinder as rf
import logging

def testThis(zipCode):
    return rf.findRegionsWProbs(zipCode)

from datetime import timedelta

def build_input_with_lags(zip_code, weather_df):
    region_probs, region_station_ids = rf.findRegionsWProbs(zip_code)

     
    lat, lon, elevation = rf.get_location_data(zip_code)  # implement or load as needed

    today = pd.Timestamp.now().normalize()
    input_data = {
        "lat": lat,
        "lon": lon,
        "elevation": elevation,
        "month": today.month,
        "dayofyear": today.dayofyear
    }

    # Initialize lag features
    for target in ["tmin", "tmax", "prcp", "pres"]:
        for lag in range(1, 4):
            input_data[f"{target}_lag{lag}"] = 0

    # Fill lag features with weighted station data
    for region_id, prob in region_probs:
        station_ids = region_station_ids.get(region_id, [])
        region_data = weather_df[weather_df["station_id"].isin(station_ids)].copy()

        for lag in range(1, 4):
            day = today - timedelta(days=lag)
            day_df = region_data[region_data["time"] == day]

            if day_df.empty:
                continue

            for target in ["tmin", "tmax", "prcp", "pres"]:
                key = f"{target}_lag{lag}"
                input_data[key] += prob * day_df[target].mean()

    #  Return as DataFrame for prediction
    return pd.DataFrame([input_data])


def fetch_last_3_days_weather(station_ids):
    today = datetime.utcnow().date()
    start = today - timedelta(days=3)
    end = today - timedelta(days=1)  # We assume we don't have today's complete data

    all_data = []

    for station_id in station_ids:
        try:
            data = Daily(station_id, start, end)
            df = data.fetch()
            df["station"] = station_id
            all_data.append(df)
        except Exception as e:
            print(f"Error fetching data for station {station_id}: {e}")

    if not all_data:
        raise ValueError("No data fetched for any stations.")

    combined_df = pd.concat(all_data)
    combined_df.reset_index(inplace=True)  # index is 'time' by default
    return combined_df



def create_lagged_features(df_weather, target_cols, date_col="time", station_col="station", max_lags=3):
    """
    Create lagged features for the given target columns in the weather data.
    
    Parameters:
    - df_weather: DataFrame with the weather data.
    - target_cols: List of columns (targets) to create lag features for (e.g., ["tmin", "tmax", "prcp", "pres"]).
    - date_col: The column in df_weather representing the date (default: "time").
    - station_col: The column in df_weather representing the station id (default: "station").
    - max_lags: The maximum number of lagged features to create (default: 3).

    Returns:
    - DataFrame with additional lagged feature columns.
    """
    for target in target_cols:
        for lag in range(1, max_lags + 1):
            # Create a new column for each lag, shifting the target column by `lag` days
            df_weather[f"{target}_lag{lag}"] = df_weather.groupby(station_col)[target].shift(lag)

    return df_weather




def predict_seven_day_forecast(zip_code):
    print(f'now about to predict for zip_code of {zip_code}')
    #  Get region probabilities and associated station_ids
    region_probs, region_station_ids = rf.findRegionsWProbs(zip_code)
   
    #  Fetch location metadata (lat, lon, elevation)
    lat, lon, elevation = rf.get_location_data(zip_code)
    today = pd.Timestamp.now().normalize()

    #  Initialize feature row
    input_data = {
        "lat": lat,
        "lon": lon,
        "elevation": elevation,
        "month": today.month,
        "dayofyear": today.dayofyear
    }

    #  Fetch last 3 days of weather for the relevant stations
    df_weather = fetch_last_3_days_weather(region_station_ids)

    #  Add lat/lon/elevation to df_weather if needed  
    df_weather["lat"] = lat
    df_weather["lon"] = lon
    df_weather["elevation"] = elevation

    target_cols = ["tmin", "tmax", "prcp", "pres"]
    #   Generate lagged features for each target (e.g., tmin_lag1, tmax_lag1)
    df_weather = create_lagged_features(df_weather, target_cols, date_col="time", station_col="station")

    #  Initialize lag features in input_data (default to 0)
    for target in ["tmin", "tmax", "prcp", "pres"]:
        for lag in range(1, 4):
            input_data[f"{target}_lag{lag}"] = 0
    # normalize the column name        
    df_weather.rename(columns={"station": "station_id"}, inplace=True)
    #  Populate lag features based on weather data and region station weights
    for region_id, prob in region_probs:
        station_ids = region_station_ids.get(region_id, [])
        region_df = df_weather[df_weather["station_id"].isin(station_ids)]

        for lag in range(1, 4):
            day = today - timedelta(days=lag)
            day_df = region_df[region_df["time"] == day]
            if day_df.empty:
                continue  # Skip if no data for that day

            # Use weighted average for each target variable
            for target in ["tmin", "tmax", "prcp", "pres"]:
                input_data[f"{target}_lag{lag}"] += prob * day_df[target].mean()

    # Convert input_data to a DataFrame
    input_df = pd.DataFrame([input_data])

    #  Prepare forecast results for all targets
    forecast = {target: [] for target in ["tmin", "tmax", "prcp", "pres"]}

    #   Predict using regional models with weighted contributions
    for target in ["tmin", "tmax", "prcp", "pres"]:
        for day in range(1, 8):
            pred_sum = 0
            total_weight = 0

            for region_id, prob in region_probs:
                # Construct path to the model
                model_path = os.path.join('app/static', 'models', f"region_{region_id}/spring", target, f"day_{day}.pkl")
                if not os.path.exists(model_path):
                    continue  # Skip if no model exists for this region and day

                model = joblib.load(model_path)
                # Predict and apply region weight
                pred = model.predict(input_df)[0]
                pred_sum += prob * pred
                total_weight += prob

            # Use weighted average prediction for the day
            forecast[target].append(pred_sum / total_weight if total_weight > 0 else None)

    print(f'return a forecast of  {forecast}')
    return forecast


if __name__ == "__main__":
    # [(region_id, probability)] followed by region_id region_station_ids
    # [(1, 0.9999335554926468)] [69052, 69052, 69052, 69052, 69052, 69052, 69052, 69052, 69052
    
    forecast = predict_seven_day_forecast('08882')
    print(f'the forecast is {forecast}')