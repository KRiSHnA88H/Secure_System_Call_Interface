from flask import Flask, request, render_template_string
import subprocess
import tempfile

app = Flask(__name__)

HTML = open("index.html").read()

@app.route("/")
def home():
    return HTML

@app.route("/run", methods=["POST"])
def run_code():
    code = request.form["code"]

    # Save code to temp file
    with tempfile.NamedTemporaryFile(delete=False, suffix=".py") as f:
        f.write(code.encode())
        filename = f.name

    try:
        # Run safely (timeout added)
        result = subprocess.run(
            ["python3", filename],
            capture_output=True,
            text=True,
            timeout=3
        )

        output = result.stdout + result.stderr

    except Exception as e:
        output = str(e)

    return f"<pre>{output}</pre><br><a href='/'>Back</a>"

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000)