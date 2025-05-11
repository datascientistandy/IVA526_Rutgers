def prepare_data(df):
    df['hour'] = df['time'].dt.hour
    df['month'] = df['time'].dt.month
    df = df[['time', 'temp', 'rhum', 'prcp', 'wspd', 'pres', 'hour', 'month']]
    df = df.dropna()
    return df
