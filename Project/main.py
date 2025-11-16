import os
import pandas
from models import DataPreparation
import kagglehub

# Définir le répertoire de travail actuel (dossier du projet)
project_dir = os.getcwd()
table_path = os.path.join(project_dir, "flightData/flight_data_2024_sample.csv")

table = pandas.read_csv(table_path, delimiter=',')
print(type(table))
print(table.head())

# Créer une instance de DataPreparation
data_prep = DataPreparation()
table = data_prep.rename_columns(data=table)
table = data_prep.add_booleanize_delays(data=table)
# save data after renaming
renamed_path = os.path.join(project_dir, "flightData/flight_data_2024_sample_renamed.csv")
table.to_csv(renamed_path, index=False)


# Afficher le résultat final
print("\nDonnées finales:")
print(table.head())
print(f"\nShape du DataFrame: {table.shape}")
print(f"Colonnes: {list(table.columns)}")