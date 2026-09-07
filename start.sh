#!/usr/bin/env sh
set -eu
cd -- "$(dirname -- "$0")"

if [ ! -x "venv/bin/python" ]; then
    python3 -m venv venv
fi

. venv/bin/activate
python -m pip install -r requirements.txt
echo "JoJo Team Builder disponível em http://127.0.0.1:5000"
python app.py
