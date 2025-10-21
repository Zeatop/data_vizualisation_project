import kagglehub
import os
import csv
import pandas

# Définir le répertoire de travail actuel (dossier du projet)
project_dir = os.getcwd()

table_path = os.path.join(project_dir, "antibiotics_multi_resistance.csv")
print(table_path)
table = pandas.read_csv(table_path, delimiter=',')
print(table.head())
