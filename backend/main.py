from fastapi import FastAPI

app = FastAPI(title="PolyListen API")

@app.get("/")
def read_root():
    return {"message": "Welcome to PolyListen backend"}
