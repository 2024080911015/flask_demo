from flask import Flask, render_template

app = Flask(__name__)

@app.route('/')
def candle_animation():
    """渲染蜡烛燃烧动画页面"""
    return render_template('candle.html')
@app.route('/about')
def about():
    return "你是个智障"
if __name__ == "__main__":
    # 使用5001端口，避免与现有app.py冲突
    app.run(host="127.0.0.1", port=5001, debug=True)