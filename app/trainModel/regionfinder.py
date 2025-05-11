from geopy.geocoders import Nominatim
import geocoder
import pandas as pd
import numpy as np
from sklearn.preprocessing import StandardScaler
from sklearn.mixture import GaussianMixture
import matplotlib.pyplot as plt
import srtm
import os
import joblib
from joblib import load, dump

#This file creates the Gaussian Mixture model GMM
# This file get regions and associated stations based on GMM results > 0.35

def loadElevation():
    # Load elevation data
    global elevation_data
    elevation_data = srtm.get_data()
    return elevation_data


#  utility function that can look up the coordinates and elevation for a given ZIP code, city, or state:
def get_location_data(query):
    """
    Resolve a city name, state or zip code to latitude, longitude, and elevation.
    """
    # Geocoder for lat/lon
    geolocator = Nominatim(user_agent="weather-region-lookup")
    elevation_data = srtm.get_data()
    # First, attempt to resolve the query
    location = geolocator.geocode(query)
    
    if location:
        lat = location.latitude
        lon = location.longitude
        elevation = elevation_data.get_elevation(lat, lon)
        # print(f"Elevation at ({lat}, {lon}): {elevation} meters")
        return lat, lon, elevation
    
    else:
        return None, None, None

       
def regions_by_BIC(df, X_scaled, n_components_range):
    bic_scores = []
    for n in n_components_range:
        gmm = GaussianMixture(n_components=n, covariance_type='full', random_state=42)
        gmm.fit(X_scaled)
        bic_scores.append(gmm.bic(X_scaled))

    # Plot BIC scores
    plt.plot(n_components_range, bic_scores, marker='o')
    plt.title("BIC vs. Number of Components")
    plt.xlabel("Number of Components")
    plt.ylabel("BIC")
    plt.show()


def regions_by_ElbowMethod(df, X_scaled, n_components_range):
    # Calculate log likelihood for various n_components
    log_likelihood = []
    '''# Test different numbers of components
    n_components_range = range(1, 21)'''
    for n in n_components_range:
        gmm = GaussianMixture(n_components=n, covariance_type='full', random_state=42)
        gmm.fit(X_scaled)
        log_likelihood.append(gmm.score(X_scaled))  # Log likelihood

    # Plot log likelihood
    plt.plot(n_components_range, log_likelihood, marker='o')
    plt.title("Log Likelihood vs. Number of Components")
    plt.xlabel("Number of Components")
    plt.ylabel("Log Likelihood")
    plt.show()


def create_GMM(df, features, n_regions=16):
    # Drop missing values in feature columns
    X = df[features].dropna()
    
    #  Fit the scaler on valid rows
    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X)

    #  Fit the Gaussian Mixture Model
    gmm = GaussianMixture(n_components=n_regions, covariance_type='full', random_state=42)
    gmm.fit(X_scaled)

    #  Predict region probabilities
    probs = gmm.predict_proba(X_scaled)
    df_probs = pd.DataFrame(probs, columns=[f'region_{i}' for i in range(n_regions)], index=X.index)

    #  Predict dominant region for each row
    region_labels = gmm.predict(X_scaled)
    df.loc[X.index, 'region'] = region_labels

    #   Optional: Add top 2 regions to df
    top_regions = probs.argsort(axis=1)[:, -2:]  # indices of top 2 regions
    df.loc[X.index, 'top_region_1'] = top_regions[:, -1]
    df.loc[X.index, 'top_region_2'] = top_regions[:, -2]
    
    file_path = os.path.join('app/static', 'models')
    #   Save model and scaler
    dump(gmm, file_path + '/gmm_weather_regions.pkl')
    dump(scaler, file_path + '/gmm_weather_scaler.pkl')

    return df, gmm, scaler

    
    
def lookupRegion(loc_feats, df, X):
    # Load the saved model
    # Scale features for better GMM performance
    file_path = os.path.join('app/static', 'models')
    gmm = load(file_path + '/gmm_weather_regions.pkl')        # Load the GMM
    scaler = load(file_path + '/gmm_weather_scaler.pkl')      # Load the scaler
    X_scaled = scaler.transform(X)  # only works if it was fitted before saving
    # [lat, lon, elev, avg_temp, avg_pressure, avg_precip, avg_snow]
    X = df[loc_feats].dropna()
   # location_features = [loc_feats]
   # location_scaled = scaler.transform(location_features)
    # location_scaled = scaler.transform(X)
    region_probs = gmm.predict_proba(X_scaled) 
    return region_probs


def main():
    elevation_data = loadElevation()
    #  DataFrame with stations data
    data_file_path = os.path.join('app/static', 'data')
    df = pd.read_csv(data_file_path + '/us_weather_featuresNeew.csv')
    #   Select the features for the GMM
    # features = ['lat', 'lon', 'elevation', 'tavg', 'tmin', 'tmax', 'pres', 'prcp', 'snow']
    features = ['lat', 'lon', 'elevation', 'tavg', 'tmin', 'tmax']
    X = df[features].dropna()  # Remove any rows with missing data

    #   Scale the features
    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X)

    # Test different numbers of components to determine optimal for use with GMM
    n_components_range = range(1, 21)
    #regions_by_BIC(df, X_scaled, n_components_range)
    # regions_by_ElbowMethod(df, X_scaled, n_components_range)
    
    create_GMM(df, features, 6)  # 6 components has been shown to be optimal
    #lookupRegion(features, df, X)
    
    


def haversine_np(lat1, lon1, lat2, lon2):
    R = 6371  # Earth radius in km
    lat1, lon1, lat2, lon2 = map(np.radians, [lat1, lon1, lat2, lon2])
    dlat = lat2 - lat1
    dlon = lon2 - lon1
    a = np.sin(dlat / 2)**2 + np.cos(lat1) * np.cos(lat2) * np.sin(dlon / 2)**2
    return 2 * R * np.arcsin(np.sqrt(a))

def getStation_df(us_weather_feature_File):
    df = pd.read_csv(us_weather_feature_File)   # "us_weather_features.csv"
    return df
    
def find_nearest_station(lat, lon, stations_df):
    distances = haversine_np(lat, lon, stations_df['lat'].values, stations_df['lon'].values)
    nearest_index = distances.argmin()
    nearest_station = stations_df.iloc[nearest_index]
    station_name = nearest_station['name'] if 'name' in nearest_station else 'Unknown Station'
    # print(f"[INFO] Nearest station is {station_name} at {distances[nearest_index]:.2f} km")
    return nearest_station

# Geocoder
def geocode_location(location_name):
    geolocator = Nominatim(user_agent="weather_gmm")
    location = geolocator.geocode(location_name)
    if location:
        return location.latitude, location.longitude
    else:
        raise ValueError(f"Could not geocode '{location_name}'")
    

# Predict top regions
def get_top_regions_for_location(location_str, stations_df, features):
    lat, lon = geocode_location(location_str)
    nearest_station = find_nearest_station(lat, lon, stations_df)
    
    # Extract and scale features
    feature_values = nearest_station[features].values.reshape(1, -1)
    scaled_values = scaler.transform(feature_values)
    
    # Predict region probabilities
    probs = gmm.predict_proba(scaled_values)
    top_indices = probs.argsort()[0, -2:][::-1]  # Top 2 regions
    
    return {
        "location": location_str,
        "lat": lat,
        "lon": lon,
        "nearest_station": nearest_station['station'],
        "top_regions": top_indices.tolist(),
        "region_probs": probs[0, top_indices].tolist()
    }

# show top two regions for city or zip 
def show_city_top_regions_on_map(city_or_zip, df, gmm, scaler, features):
    """
    df: DataFrame of all stations with ['lat', 'lon', 'region', 'name' (optional)]
    gmm: Trained GaussianMixture model
    scaler: StandardScaler used to normalize GMM input
    features: List of feature columns used to fit the GMM
    """
    from geopy.geocoders import Nominatim
    import plotly.express as px

    # Geocode
    geolocator = Nominatim(user_agent="weather_gmm_locator")
    location = geolocator.geocode(city_or_zip)
    if location is None:
        raise ValueError(f"Could not find coordinates for {city_or_zip}")
    lat, lon = location.latitude, location.longitude
    #print(f"[INFO] Coordinates for {city_or_zip}: {lat:.4f}, {lon:.4f}")

    # Find nearest station
    distances = haversine_np(df['lon'].values, df['lat'].values, lon, lat)
    nearest_index = distances.argmin()
    nearest_station = df.iloc[nearest_index]
    #print(f"[INFO] Nearest station: {nearest_station.get('station', 'Unknown')}")

    # Prepare GMM features of the station
    # X_input = nearest_station[features].values.reshape(1, -1)
    X_input = pd.DataFrame([nearest_station[features].values], columns=features)
    X_scaled = scaler.transform(X_input)

    # Predict top 2 regions
    probs = gmm.predict_proba(X_scaled).flatten()
    top2 = probs.argsort()[-2:][::-1]
    #print(f"[INFO] Top 2 regions: {top2.tolist()} with probabilities {probs[top2].round(3).tolist()}")
    # Assign back to original DataFrame using correct indices
    df.loc[X_input.index, 'region'] = top2[0]
    df.loc[X_input.index, 'region_2'] = top2[1]
    # Plot all stations and highlight top 2 region clusters
    df_top2 = df[df['region'].isin(top2)]

    fig = px.scatter_geo(df_top2,
                         lat='lat',
                         lon='lon',
                         color='region',
                         hover_name=df.get('name', None),
                         title=f'Top 2 GMM Regions for {city_or_zip}',
                         scope='usa',
                         opacity=0.6)

    fig.add_scattergeo(
        lat=[lat], lon=[lon],
        mode='markers+text',
        marker=dict(size=10, color='red', symbol='star'),
        text=[f"{city_or_zip}"],
        textposition="top center",
        name='Input Location'
    )

    fig.update_layout(legend_title="GMM Region")
    fig.show()


'''show_city_top_regions_on_map("Newark, NJ", stations_df, gmm, scaler, features=[
    'lat', 'lon', 'elevation', 'avg_temp', 'avg_pressure', 'avg_precip', 'avg_snowfall'
])'''

'''
# Load models
gmm = load('gmm_weather_regions.pkl')
scaler = load('gmm_weather_scaler.pkl')

'''



#import folium
# from folium.plugins import MarkerCluster
import pandas as pd
import numpy as np
'''
def show_and_save_city_top_regions(city_name, lat, lon, gmm, scaler, stations_df, station_region_map, threshold=0.35):
    """
    Given a city name and lat/lon, predict the top region(s) from GMM and show them on a map.
    Also return the regions and the corresponding station_ids.

    Args:
        city_name (str): Name of the city.
        lat (float): Latitude of the city.
        lon (float): Longitude of the city.
        gmm (GaussianMixture): Trained GMM model.
        scaler (StandardScaler): Scaler fitted on original station features.
        stations_df (pd.DataFrame): Station information dataframe.
        station_region_map (dict): Mapping station_id -> assigned region.
        threshold (float): Probability threshold to consider multiple regions.

    Returns:
        top_regions (list): List of top region numbers.
        region_station_ids (dict): Mapping of region -> list of station_ids.
        folium.Map: The generated map.
    """
    # Prepare feature array
    X_input = np.array([[lat, lon]])
    X_scaled = scaler.transform(X_input)

    # Get region probabilities
    region_probs = gmm.predict_proba(X_scaled)[0]

    # Identify regions with probability >= threshold
    top_regions = np.where(region_probs >= threshold)[0].tolist()

    if not top_regions:
        # No region passes threshold, select the single most probable one
        top_regions = [np.argmax(region_probs)]

    print(f"[INFO] Top regions for {city_name}: {top_regions} with probabilities {[region_probs[r] for r in top_regions]}")

    # Map stations to regions
    region_station_ids = {region: [] for region in top_regions}
    for station_id, region in station_region_map.items():
        if region in top_regions:
            region_station_ids[region].append(station_id)

    # Create Map
    map_center = [lat, lon]
    city_map = folium.Map(location=map_center, zoom_start=6)
    marker_cluster = MarkerCluster().add_to(city_map)

    # Plot stations colored by region
    colors = ['red', 'blue', 'green', 'purple', 'orange', 'darkred', 'lightred',
              'beige', 'darkblue', 'darkgreen', 'cadetblue', 'darkpurple',
              'white', 'pink', 'lightblue', 'lightgreen', 'gray', 'black', 'lightgray']

    for idx, row in stations_df.iterrows():
        station_id = row['station_id']
        station_lat = row['lat']
        station_lon = row['lon']
        station_name = row.get('name', '')

        station_region = station_region_map.get(station_id, None)
        if station_region in top_regions:
            color_idx = top_regions.index(station_region) % len(colors)
            folium.Marker(
                location=[station_lat, station_lon],
                popup=f"{station_name} (Station ID: {station_id})\nRegion {station_region}",
                icon=folium.Icon(color=colors[color_idx])
            ).add_to(marker_cluster)

    # Also add the city center
    folium.Marker(
        location=[lat, lon],
        popup=f"City Center: {city_name}",
        icon=folium.Icon(color='black', icon='info-sign')
    ).add_to(city_map)

    return top_regions, region_station_ids, city_map
'''
import numpy as np
import pandas as pd
# import folium
# from folium import features

import geopy
from geopy.geocoders import Nominatim
import time

def show_and_save_city_top_regions(location_str, scaler, gmm, stations_df, feature_cols, min_region_prob=0.35):
    """
    Given a city name or zipcode, find the top GMM regions, and return relevant station IDs.

    Args:
        location_str (str): City name or Zipcode (example: "Albany, NY" or "12207")
        scaler: Fitted StandardScaler used for GMM
        gmm: Fitted Gaussian Mixture Model
        stations_df: DataFrame of station info, must include 'lat', 'lon', 'region', 'station_id', etc
        feature_cols (list): Columns used to scale for GMM (example: ['lat', 'lon', 'elevation', 'avg_temp', ...])
        min_region_prob (float): Minimum probability threshold to accept multiple regions
        
    Returns:
        top_regions (list of int)
        region_station_ids (dict)
        city_map (folium.Map)
    """
    #  Geocode city or zipcode into lat/lon
    geolocator = Nominatim(user_agent="gmm_weather_locator")
    location = None
    for attempt in range(3):
        try:
            location = geolocator.geocode(location_str)
            if location:
                break
        except:
            time.sleep(1)
    if location is None:
        raise ValueError(f"Could not geocode location: {location_str}")

    input_lat, input_lon = location.latitude, location.longitude
    #print(f"[INFO] Geocoded {location_str} to lat={input_lat:.4f}, lon={input_lon:.4f}")

    #   Find nearest station
    from numpy import radians, sin, cos, sqrt, arctan2
    def haversine_np(lon1, lat1, lon2, lat2):
        R = 6371  # Earth radius in km
        lon1, lat1, lon2, lat2 = map(radians, [lon1, lat1, lon2, lat2])
        dlon = lon2 - lon1
        dlat = lat2 - lat1
        a = sin(dlat/2)**2 + cos(lat1) * cos(lat2) * sin(dlon/2)**2
        c = 2 * arctan2(sqrt(a), sqrt(1-a))
        return R * c

    distances = haversine_np(
        input_lon, input_lat,
        stations_df['lon'].values, stations_df['lat'].values
    )
    nearest_index = distances.argmin()
    nearest_station = stations_df.iloc[nearest_index]
    #print(f"[INFO] Nearest station is {nearest_station.get('name', 'Unknown Station')} at {distances[nearest_index]:.2f} km")
    # X = stations_df[feature_cols].values 
    # Prepare feature array
    X = stations_df[feature_cols]

    # Drop any rows with missing data
    X = X.dropna()

    # Now scale
    X_scaled = scaler.transform(X)

    # Predict regions
    region_labels = gmm.predict(X_scaled)

    # Assign back (only for rows with complete features)
    stations_df_clean = stations_df.loc[X.index].copy()
    stations_df_clean['region'] = region_labels
   

    #  Prepare input for GMM
    # station_features = nearest_station[feature_cols].values.reshape(1, -1)
    station_features = nearest_station[feature_cols].to_frame().T
    station_scaled = scaler.transform(station_features)
    
    #  Predict region probabilities
    probs = gmm.predict_proba(station_scaled)[0]
    region_probs = [(i, p) for i, p in enumerate(probs)]
    region_probs.sort(key=lambda x: x[1], reverse=True)

    top_regions = []
    for region, prob in region_probs:
        if prob >= min_region_prob:
            top_regions.append((region, prob))
        else:
            break
    if not top_regions:
        top_regions = [(region_probs[0][0], region_probs[0][1])]   # Always include top-1 region if none >= min_region_prob

    #print(f"[INFO] Top regions for {location_str}: {top_regions}")

    #  Find stations in top regions
    '''region_station_ids = {}
    for region in top_regions:
        station_ids = stations_df_clean[stations_df_clean['region'] == region]['station_id'].tolist()
        region_station_ids[region] = station_ids'''
    region_station_ids = {}
    for region, _ in top_regions:
        station_ids = stations_df_clean[stations_df_clean['region'] == region]['station_id'].tolist()
        region_station_ids[region] = station_ids

    #print(f"Top regions with probabilities: {top_regions}")
    #print(f"Region station IDs: {region_station_ids}")
    # print(f'the statino ids are {region_station_ids}')
    '''#  Create interactive map
    import folium

    city_map = folium.Map(location=[input_lat, input_lon], zoom_start=7)
    colors = ['red', 'blue', 'green', 'purple', 'orange', 'darkred', 'lightred', 'beige',
              'darkblue', 'darkgreen', 'cadetblue', 'darkpurple', 'white', 'pink', 'lightblue']

    for region_idx, region in enumerate(top_regions):
        region_stations = stations_df_clean[stations_df_clean['region'] == region]
        for _, row in region_stations.iterrows():
            folium.CircleMarker(
                location=[row['lat'], row['lon']],
                radius=4,
                popup=f"Station {row.get('station', '')}",
                color=colors[region_idx % len(colors)],
                fill=True,
                fill_opacity=0.7
            ).add_to(city_map)

    folium.Marker([input_lat, input_lon], popup=f"Input: {location_str}", icon=folium.Icon(color='black')).add_to(city_map)
''' 
    #print(f' the top regions are {top_regions} and the region_station_ids are{region_station_ids}')
    return top_regions, region_station_ids # , city_map

def findRegionsWProbs(zipCode):
    data_file_path = os.path.join('app/static', 'data')
    file_path = os.path.join('app/static', 'models')
    gmm = load(file_path + '/gmm_weather_regions.pkl')
    scaler = load(file_path + '/gmm_weather_scaler.pkl')
    df = getStation_df(data_file_path + "/us_weather_featuresNeew.csv")
    features = ['lat', 'lon', 'elevation', 'tavg', 'tmin', 'tmax']
    # features = ['lat', 'lon', 'elevation', 'tavg', 'tmin', 'tmax', 'pres', 'prcp', 'snow']
    return show_and_save_city_top_regions(zipCode, scaler, gmm, df, features, min_region_prob=0.35)
 
 
# regionfinder.py


                                                                                  
def get_all_region_station_ids(station_csv, gmm_model_path, scaler_path, features=["lat", "lon", "elevation", "tavg", "tmin", "tmax"]):
    df = pd.read_csv(station_csv)
    df = df.dropna(subset=features)

    scaler = joblib.load(scaler_path)
    gmm = joblib.load(gmm_model_path)

    X_scaled = scaler.transform(df[features])
    region_labels = gmm.predict(X_scaled)
    df['region'] = region_labels

    region_station_map = df.groupby('region')['station_id'].apply(list).to_dict()
    return region_station_map
 
 
 
    
    
if __name__ == "__main__":
  main()
  ''' # Load models
    gmm = load('gmm_weather_regions.pkl')
    scaler = load('gmm_weather_scaler.pkl')
   # main()
   # df = getStation_df("us_weather_features.csv")
    df = getStation_df("us_weather_featuresNeew.csv")
    #features = ['lat', 'lon', 'elevation', 'avg_temp', 'avg_pressure', 'avg_precip', 'avg_snowfall']
    # features = ['lat', 'lon', 'elevation', 'tavg']
    # should take off snow from built model, as that is sometimes not reported
    features = ['lat', 'lon', 'elevation', 'tavg', 'tmin', 'tmax', 'pres', 'prcp', 'snow']
    #result = get_top_regions_for_location("Newark, NJ", df, features)
    # show_city_top_regions_on_map("Newark, NJ", df, gmm, scaler, features)
    show_and_save_city_top_regions("12207", scaler, gmm, df, features, min_region_prob=0.35)
'''
    #print(result)

