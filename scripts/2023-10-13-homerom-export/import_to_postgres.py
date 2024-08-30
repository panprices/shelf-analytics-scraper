import pandas as pd
from sqlalchemy import create_engine

df = pd.read_csv("Artikelnummer - Venture.xlsx - Blad1.csv")

print(df)
print(df.dtypes)

conn_string = (
    "postgresql+psycopg2://postgres:3pP49KAMpd0HefyA@localhost/shelf_analytics_prod"
)

db = create_engine(conn_string)
conn = db.connect()
POSTGRES_TABLE_NAME = "temp_vd_homeroom_2023_10_13"
# df.to_sql(POSTGRES_TABLE_NAME, con=conn, if_exists="fail", index=False, chunksize=1000)
