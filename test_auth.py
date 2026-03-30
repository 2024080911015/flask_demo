import requests
import json

BASE_URL = "http://localhost:5001"

def test_register():
    print("=== 测试注册接口（方式一：传完整info）===")
    data = {
        "username": "testuser1",
        "password": "123456",
        "info": "性别:男,年级:大二,专业:计算机,爱好:编程,标签:萌新"
    }
    response = requests.post(f"{BASE_URL}/api/register", json=data)
    print(f"状态码: {response.status_code}")
    print(f"响应: {json.dumps(response.json(), ensure_ascii=False, indent=2)}")
    return response

def test_register_v2():
    print("\n=== 测试注册接口（方式二：分别传字段）===")
    data = {
        "username": "testuser2",
        "password": "123456",
        "gender": "女",
        "grade": "大三",
        "major": "软件工程",
        "hobbies": "音乐 阅读",
        "tags": "可爱 作息规律"
    }
    response = requests.post(f"{BASE_URL}/api/register", json=data)
    print(f"状态码: {response.status_code}")
    print(f"响应: {json.dumps(response.json(), ensure_ascii=False, indent=2)}")
    return response

def test_login(username="testuser1"):
    print(f"\n=== 测试登录接口（用户: {username}）===")
    data = {
        "username": username,
        "password": "123456"
    }
    response = requests.post(f"{BASE_URL}/api/auth/login", json=data)
    print(f"状态码: {response.status_code}")
    print(f"响应: {json.dumps(response.json(), ensure_ascii=False, indent=2)}")
    print(f"Session ID: {response.cookies.get('session')}")
    return response

def test_current_user(cookies):
    print("\n=== 测试获取当前用户 ===")
    response = requests.get(f"{BASE_URL}/api/auth/me", cookies=cookies)
    print(f"状态码: {response.status_code}")
    print(f"响应: {json.dumps(response.json(), ensure_ascii=False, indent=2)}")
    return response

def test_logout(cookies):
    print("\n=== 测试登出 ===")
    response = requests.post(f"{BASE_URL}/api/auth/logout", cookies=cookies)
    print(f"状态码: {response.status_code}")
    print(f"响应: {json.dumps(response.json(), ensure_ascii=False, indent=2)}")
    return response

if __name__ == "__main__":
    # 1. 注册（方式一）
    test_register()

    # 2. 注册（方式二）
    test_register_v2()

    # 3. 登录
    login_response = test_login("testuser2")
    cookies = login_response.cookies

    # 4. 检查登录状态
    test_current_user(cookies)

    # 5. 登出
    test_logout(cookies)

    # 6. 再次检查登录状态
    test_current_user(cookies)
