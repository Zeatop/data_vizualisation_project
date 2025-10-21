import kagglehub
import os
import csv

# Définir le répertoire de travail actuel (dossier du projet)
project_dir = os.getcwd()
print(f"Répertoire de travail: {project_dir}")

# Définir le répertoire de téléchargement relatif au projet
data_dir = os.path.join(project_dir, "data")
os.environ['KAGGLE_CACHE_DIR'] = data_dir

# Créer le répertoire s'il n'existe pas
os.makedirs(data_dir, exist_ok=True)
print(f"Répertoire des données: {data_dir}")

path = kagglehub.dataset_download("adilimadeddinehosni/multi-resistance-antibiotic-susceptibility")

print("Path to dataset files:", path)