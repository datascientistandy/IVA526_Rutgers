import pandas as pd
from sklearn.preprocessing import LabelEncoder, MinMaxScaler
from sklearn.metrics import pairwise_distances
from sklearn.cluster import AgglomerativeClustering
import json
import os

def process_climate_data(csv_path, output_json_path):
    df = pd.read_csv(csv_path)

    # Select relevant features
    features = [
        "TEMP", "DEWP", "MXSPD", "PRCP", "SNDP",
        "FRSHTT", "FRSHTT_DETAIL", "WeatherDetail"
    ]

    # Clean up: fill missing with median
    for col in features:
        if df[col].dtype == object:
            df[col] = df[col].fillna("None")
        else:
            df[col] = pd.to_numeric(df[col], errors='coerce')
            df[col] = df[col].fillna(df[col].median())

    # Encode categorical
    df["FRSHTT_DETAIL"] = LabelEncoder().fit_transform(df["FRSHTT_DETAIL"].astype(str))

    # Normalize
    scaler = MinMaxScaler()
    scaled_data = scaler.fit_transform(df[features])

    # Binarize for Jaccard
    binary_data = (scaled_data > 0.5).astype(int)
    similarity_matrix = 1 - pairwise_distances(binary_data, metric="jaccard")

    # Clustering
    clustering = AgglomerativeClustering(n_clusters=3, affinity='precomputed', linkage='average')
    df['cluster'] = clustering.fit_predict(1 - similarity_matrix)

    # Prepare D3 graph format
    nodes = []
    links = []
    for i, row in df.iterrows():
        nodes.append({
            "id": int(i),
            "TEMP": row["TEMP"],
            "DEWP": row["DEWP"],
            "MXSPD": row["MXSPD"],
            "PRCP": row["PRCP"],
            "cluster": int(row["cluster"])
        })

    threshold = 0.5
    for i in range(len(df)):
        for j in range(i + 1, len(df)):
            if similarity_matrix[i, j] > threshold:
                links.append({
                    "source": int(i),
                    "target": int(j),
                    "value": float(similarity_matrix[i, j])
                })

    graph_data = {"nodes": nodes, "links": links}

    # Save to JSON for D3
    with open(output_json_path, "w") as f:
        json.dump(graph_data, f, indent=2)

# Example usage
if __name__ == "__main__":
    csv_path = "C:/Users/JenniferN/Documents/IVA526ClassProj/iva526ClassProj/app/data/climateData.csv"  # Adjust path as needed
    output_json = "C:/Users/JenniferN/Documents/IVA526ClassProj/iva526ClassProj/app/data/graph.json"  # Save where D3.js can access
    os.makedirs(os.path.dirname(output_json), exist_ok=True)
    process_climate_data(csv_path, output_json)
    print(f"Graph data written to {output_json}")
