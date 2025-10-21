import kagglehub
import os

# Définir le répertoire de téléchargement dans le projet
data_dir = "/Users/leojackson/Documents/MIAGE/dataAnalysis/dataVizualisation"
os.environ['KAGGLE_CACHE_DIR'] = data_dir

# Créer le répertoire s'il n'existe pas
os.makedirs(data_dir, exist_ok=True)

path = kagglehub.dataset_download("adilimadeddinehosni/multi-resistance-antibiotic-susceptibility")

print("Path to dataset files:", path)