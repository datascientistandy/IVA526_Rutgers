from sklearn.ensemble import RandomForestRegressor
from sklearn.metrics import mean_absolute_error
import pandas as pd
import os
import joblib

import regionfinder as rf

'''def save_model(model, region_id, target, day):
    file_path = os.path.join('app/static', 'models')
    path = f"{file_path}/region_{region_id}/{target}"
    os.makedirs(path, exist_ok=True)
    joblib.dump(model, f"{path}/day_{day}.pkl")'''
    
def save_model(model, region_id, target, day, season="spring"):
    # Define the root directory where models will be saved
    file_path = os.path.join('app/static', 'models')

    # Update the path to include the season (e.g., 'spring', 'summer', etc.)
    path = os.path.join(file_path, f"region_{region_id}", season, target)
    
    # Create the directories if they don't exist
    os.makedirs(path, exist_ok=True)
    
    # Save the model to the specified path
    joblib.dump(model, os.path.join(path, f"day_{day}.pkl"))


def create_lagged_features(df, target_cols, date_col, group_col, lags=3):
    df = df.sort_values(by=[group_col, date_col])
    for target in target_cols:
        for lag in range(1, lags + 1):
            df[f"{target}_lag{lag}"] = df.groupby(group_col)[target].shift(lag)
    return df

def create_forecast_targets(df, target_cols, date_col, group_col, forecast_days=7):
    for target in target_cols:
        for day in range(1, forecast_days + 1):
            df[f"{target}_d{day}"] = df.groupby(group_col)[target].shift(-day)
    return df

def train_and_save_models_by_region(
    weather_df: pd.DataFrame,
    region_station_ids: dict,
    date_col: str = "time",
    station_col: str = "station_id",
    feature_cols: list = None,
    target_cols: list = None,
    season_months: set = None,
    test_split_frac: float = 0.2,
    random_state: int = 42,
    min_non_null_rows: int = 100
):
    results = {}

    weather_df[date_col] = pd.to_datetime(weather_df[date_col])
    weather_df = create_lagged_features(weather_df, target_cols, date_col, station_col)
    weather_df = create_forecast_targets(weather_df, target_cols, date_col, station_col)

    for region_id, station_ids in region_station_ids.items():
        region_df = weather_df[weather_df[station_col].isin(station_ids)].copy()

        if region_df.empty:
            continue

        region_df["month"] = region_df[date_col].dt.month
        region_df["dayofyear"] = region_df[date_col].dt.dayofyear

        if season_months:
            region_df = region_df[region_df["month"].isin(season_months)]

        # Drop NA in features
        lagged_feature_cols = [col for col in region_df.columns if any(t in col for t in target_cols) and "lag" in col]
        all_feature_cols = feature_cols + lagged_feature_cols
        region_df = region_df.dropna(subset=all_feature_cols)

        available_targets = target_cols.copy()
        if "snowfall" in weather_df.columns and region_df["snowfall"].notna().sum() >= min_non_null_rows:
            available_targets.append("snowfall")

        region_results = {}

        for target in available_targets:
            for day in range(1, 8):
                future_target_col = f"{target}_d{day}"
                if future_target_col not in region_df.columns:
                    continue

                df_target = region_df.dropna(subset=[future_target_col])

                if len(df_target) < min_non_null_rows:
                    continue

                df_target = df_target.sample(frac=1, random_state=random_state).reset_index(drop=True)
                split_idx = int(len(df_target) * (1 - test_split_frac))
                train_df = df_target.iloc[:split_idx]
                val_df = df_target.iloc[split_idx:]

                X_train = train_df[all_feature_cols]
                y_train = train_df[future_target_col]
                X_val = val_df[all_feature_cols]
                y_val = val_df[future_target_col]

                model = RandomForestRegressor(n_estimators=100, random_state=random_state)
                model.fit(X_train, y_train)
                preds = model.predict(X_val)

                mae = mean_absolute_error(y_val, preds)
                # save_model(model, region_id, target, day)
                # Save the model specifically for the "spring" season
                save_model(model, region_id, target, day, season="spring")

                print(f"[TRAINED] Region {region_id} | {target} Day {day} | MAE: {mae:.2f}")
                region_results[f"{target}_d{day}"] = mae

        if region_results:
            results[region_id] = region_results

    return results

if __name__ == "__main__":
    file_path = os.path.join('app/static', 'models')
    data_file_path = os.path.join('app/static', 'data')
    weather_df = rf.getStation_df(data_file_path + "/us_weather_featuresNeew.csv")
    region_station_ids = rf.get_all_region_station_ids(
    station_csv= data_file_path +  "/us_weather_featuresNeew.csv",  # or path to your station feature CSV
    gmm_model_path= file_path + "/gmm_weather_regions.pkl",
    scaler_path= file_path + "/gmm_weather_scaler.pkl"
    )


    feature_cols = ["lat", "lon", "elevation", "month", "dayofyear"]
    target_cols = ["tmin", "tmax", "prcp", "pres"]

    results = train_and_save_models_by_region(
        weather_df=weather_df,
        region_station_ids=region_station_ids,
        feature_cols=feature_cols,
        target_cols=target_cols,
        season_months={3, 4, 5} # Spring models
    )

   