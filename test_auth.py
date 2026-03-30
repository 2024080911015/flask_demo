import requests
import json

BASE_URL = "http://localhost:5001"

def test_register():
    print("=== 测试注册接口 ===")
    data = {
        "username": "testuser",
        "password": "123456",
        "info": "性别:男,年级:大二,专业:计算机,爱好:编程,标签:萌新"
    }
    response = requests.post(f"{BASE_URL}/api/register", json=data)
    print(f"状态码: {response.status_code}")
    print(f"响应: {json.dumps(response.json(), ensure_ascii=False, indent=2)}")
    return response

def test_login():
    print("\n=== 测试登录接口 ===")
    data = {
        "username": "testuser",
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
    # 1. 注册
    reg_response = test_register()

    # 2. 登录
    login_response = test_login()
    cookies = login_response.cookies

    # 3. 检查登录状态
    test_current_user(cookies)

    # 4. 登出
    test_logout(cookies)

    # 5. 再次检查登录状态
    test_current_user(cookies)
