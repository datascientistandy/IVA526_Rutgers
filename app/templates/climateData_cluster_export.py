import pandas as pd
from sklearn.decomposition import PCA
from sklearn.cluster import KMeans
import json

# Load the dataset
df = pd.read_csv("climateData.csv")

# Select and clean numeric columns
features = ['TEMP', 'PRCP', 'MXSPD', 'DEWP', 'ELEVATION']
df_clean = df.dropna(subset=features).copy()

# Apply PCA (2D for visual use)
pca = PCA(n_components=2)
pca_result = pca.fit_transform(df_clean[features])
df_clean['PCA1'] = pca_result[:, 0]
df_clean['PCA2'] = pca_result[:, 1]

# Apply KMeans clustering
k = 5  # Number of clusters
kmeans = KMeans(n_clusters=k, random_state=42)
df_clean['cluster'] = kmeans.fit_predict(pca_result)

# Structure data for D3
clusters = []
for cluster_id in sorted(df_clean['cluster'].unique()):
    cluster_group = df_clean[df_clean['cluster'] == cluster_id]
    children = []

    for idx, row in cluster_group.iterrows():
        children.append({
            "name": f"{row['LOCATION']} ({row['STATE']})",
            "data": {
                "TEMP": row["TEMP"],
                "PRCP": row["PRCP"],
                "MXSPD": row["MXSPD"],
                "DEWP": row["DEWP"],
                "ELEVATION": row["ELEVATION"],
                "PCA1": row["PCA1"],
                "PCA2": row["PCA2"]
            }
        })

    clusters.append({
        "name": f"Cluster {cluster_id}",
        "children": children
    })

# Create root node
final_structure = {
    "name": "Climate Clusters",
    "children": clusters
}

# Export to JSON
with open("climate_clustered.json", "w") as f:
    json.dump(final_structure, f, indent=2)

print("Exported to climate_clustered.json")
