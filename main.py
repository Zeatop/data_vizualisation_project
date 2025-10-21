import os
import pandas
from models import DataPreparation

# Définir le répertoire de travail actuel (dossier du projet)
project_dir = os.getcwd()
table_path = os.path.join(project_dir, "antibiotics_multi_resistance.csv")

print(table_path)
table = pandas.read_csv(table_path, delimiter=',')
print(type(table))
print(table.head())

# Créer une instance de DataPreparation
data_prep = DataPreparation()

# Appeler les méthodes sur l'instance et récupérer les résultats
table = data_prep.prepare_location_data(table)
table = data_prep.prepare_age_and_gender_data(table)
table = data_prep.delete_useless_columns(data=table, columns_to_delete=['Notes'])

# Afficher le résultat final
print("\nDonnées finales:")
print(table.head())
print(f"\nShape du DataFrame: {table.shape}")
print(f"Colonnes: {list(table.columns)}")