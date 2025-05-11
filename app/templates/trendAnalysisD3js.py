import pandas as pd

# Load the CSV file
df = pd.read_csv("climateData.csv")

# Convert the date column
df['date'] = pd.to_datetime(df['date_str'])

# Define seasons
def get_season(date):
    month = date.month
    if month in [12, 1, 2]:
        return 'Winter'
    elif month in [3, 4, 5]:
        return 'Spring'
    elif month in [6, 7, 8]:
        return 'Summer'
    else:
        return 'Fall'

df['season'] = df['date'].apply(get_season)

# Prepare a cleaner version of the dataset for D3
columns_to_export = ['date_str', 'max_temp', 'degrees_from_mean', 'station_name', 'type', 'season']
df_cleaned = df[columns_to_export]

# Save to CSV for D3.js use
df_cleaned.to_csv("processed_weather_anomalies.csv", index=False)
