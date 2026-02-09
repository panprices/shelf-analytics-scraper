import os

import pandas as pd
from sqlalchemy import create_engine

if __name__ == "__main__":
    df = pd.read_excel("Venture Aktiva artiklar.xlsx")

    print(df)
    print(df.dtypes)

    conn_string = f"postgresql+psycopg2://postgres:{os.getenv('DB_PASS')}@localhost/shelf_analytics_prod"

    db = create_engine(conn_string)
    conn = db.connect()

    # CHANGE THIS!
    POSTGRES_TABLE_NAME = "temp_vd_trademax_2024_08_28"
    # df.to_sql(POSTGRES_TABLE_NAME, con=conn, if_exists="fail", index=False, chunksize=1000)
