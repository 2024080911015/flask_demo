from flask import Flask,request, jsonify
app =Flask(__name__)
app.json.ensure_ascii = False
RECOMMEND_DB = {
    1: ["小明", "小红", "小刚"],
    2: ["Alice", "Bob"],
    3: ["张三", "李四", "王五"],
}
@app.route('/')
def home():
    return "Flask is running. Try /tuijian?id=1"
@app.route('/tuijian')
def tuijian():
    sid=request.args.get('id',default=None, type=int)
    if sid is None:
        return jsonify({"error": "Missing 'id' parameter"}), 400
    rec=RECOMMEND_DB.get(sid, [])
    return jsonify({
        "student_id": sid,
        "recommend_friends": rec,
        "count": len(rec)
    }
    )
if __name__ == "__main__":
    # host=127.0.0.1 表示只在本机访问；port=5000 是默认端口
    app.run(host="127.0.0.1", port=5000, debug=True)