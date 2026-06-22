import time
import hashlib
import requests

def upload_to_cloudinary(file_path, cloud_name, api_key, api_secret):
    timestamp = int(time.time())
    
    # Sort parameters for signature
    # Since we only have 'timestamp' here, it's just 'timestamp=<timestamp>'
    param_str = f"timestamp={timestamp}{api_secret}"
    signature = hashlib.sha1(param_str.encode('utf-8')).hexdigest()
    
    url = f"https://api.cloudinary.com/v1_1/{cloud_name}/image/upload"
    
    try:
        with open(file_path, "rb") as f:
            files = {
                "file": f
            }
            data = {
                "api_key": api_key,
                "timestamp": timestamp,
                "signature": signature
            }
            response = requests.post(url, files=files, data=data, timeout=30)
            
        if response.status_code == 200:
            res_data = response.json()
            return True, res_data.get("secure_url"), res_data.get("public_id")
        else:
            return False, response.text, None
    except Exception as e:
        return False, str(e), None
