import pandas as pd
import numpy as np
from statsmodels.tsa.statespace.sarimax import SARIMAX
import json

# Load CSV
data = pd.read_csv("weather-anomalies-1964-2013.csv", parse_dates=["date_str"])

# Extract year, month
data["month"] = data["date_str"].dt.month
data["year"] = data["date_str"].dt.year

# Define season from month
def get_season(month):
    if month in [12, 1, 2]:
        return "Winter"
    elif month in [3, 4, 5]:
        return "Spring"
    elif month in [6, 7, 8]:
        return "Summer"
    else:
        return "Fall"

data["season"] = data["month"].apply(get_season)

# Create monthly datetime for grouping
data["month_year"] = pd.to_datetime(data["date_str"].dt.to_period("M").astype(str))

# Group by month and year: average max_temp
monthly_max_temp = data.groupby("month_year")["max_temp"].mean().sort_index()

# Fit SARIMA model to account for trend and seasonality
model = SARIMAX(monthly_max_temp, order=(1, 1, 1), seasonal_order=(1, 1, 1, 12))
results = model.fit(disp=False)

# Forecast 12 months ahead
forecast_steps = 12
forecast_index = pd.date_range(start=monthly_max_temp.index[-1] + pd.offsets.MonthBegin(),
                               periods=forecast_steps, freq='MS')
forecast = results.get_forecast(steps=forecast_steps)
forecast_mean = forecast.predicted_mean
fitted_values = results.fittedvalues

# Detect trend direction
slope = np.polyfit(range(len(monthly_max_temp)), monthly_max_temp.values, 1)[0]
trend_direction = "increasing" if slope > 0 else "decreasing"

# Prepare data for D3.js
data_for_d3 = {
    "observed": [
        {"date": d.strftime("%Y-%m"), "value": v}
        for d, v in monthly_max_temp.items()
    ],
    "fitted": [
        {"date": d.strftime("%Y-%m"), "value": v}
        for d, v in fitted_values.items()
    ],
    "forecast": [
        {"date": d.strftime("%Y-%m"), "value": v}
        for d, v in zip(forecast_index, forecast_mean)
    ],
    "meta": {
        "trend_direction": trend_direction,
        "model": "SARIMA(1,1,1)(1,1,1)[12]",
        "source": "weather-anomalies-1964-2013.csv"
    }
}

# Save to JSON
with open("max_temp_trend_forecast.json", "w") as f:
    json.dump(data_for_d3, f, indent=2)

print("✅ JSON output saved to max_temp_trend_forecast.json")
