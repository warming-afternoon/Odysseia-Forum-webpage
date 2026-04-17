import json
import sys
import os

# 获取脚本所在目录和项目根目录
script_dir = os.path.dirname(os.path.abspath(__file__))
# 前端项目的根目录
webpage_dir = os.path.abspath(os.path.join(script_dir, '../'))
# 后端项目的目录（与前端平级）
root_dir = os.path.abspath(os.path.join(webpage_dir, '../Odysseia-Forum'))


# 切换到项目根目录（为了正确读取 config.json 等）
os.chdir(root_dir)

# 将 src 目录加入 python 路径
sys.path.append(os.path.join(root_dir, 'src'))

try:
    from api.main import app
    print(f"Successfully imported app from api.main (Root: {root_dir})")
    
    openapi_data = app.openapi()
    output_path = os.path.join(webpage_dir, 'openapi.json')
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(openapi_data, f, indent=2, ensure_ascii=False)
    
    print(f"Successfully exported openapi.json to {output_path}")
except Exception as e:
    import traceback
    traceback.print_exc()
    print(f"Error exporting openapi: {e}")
    sys.exit(1)
