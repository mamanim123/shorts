import os
BASE = os.path.dirname(os.path.abspath(__file__))
FILE_PATH = os.path.join(BASE, "features", "shorts-lab", "components", "TubeFactoryPanel.tsx")
print("PATH:", FILE_PATH)
print("EXISTS:", os.path.exists(FILE_PATH))
