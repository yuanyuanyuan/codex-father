#!/usr/bin/env python3
"""
批量为JSON Schema添加additionalProperties: false约束
"""

import json
import os
from pathlib import Path

def add_additional_properties(obj):
    """递归地为所有object类型添加additionalProperties: false"""
    if isinstance(obj, dict):
        # 如果是object类型且没有additionalProperties，添加它
        if obj.get('type') == 'object' and 'additionalProperties' not in obj:
            obj['additionalProperties'] = False
        
        # 递归处理所有值
        for key, value in obj.items():
            if isinstance(value, dict):
                add_additional_properties(value)
            elif isinstance(value, list):
                for item in value:
                    if isinstance(item, dict):
                        add_additional_properties(item)
    
    return obj

def process_schema_file(filepath):
    """处理单个schema文件"""
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            schema = json.load(f)
        
        # 添加additionalProperties约束
        add_additional_properties(schema)
        
        # 写回文件
        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(schema, f, indent=2, ensure_ascii=False)
        
        print(f"✅ 已处理: {filepath}")
        return True
    except Exception as e:
        print(f"❌ 处理失败 {filepath}: {e}")
        return False

def main():
    # 找到所有schema文件
    schema_dir = Path('/data/codex-father/tests/schemas')
    schema_files = list(schema_dir.glob('*.schema.json'))
    
    print(f"找到 {len(schema_files)} 个schema文件\n")
    
    success_count = 0
    for schema_file in sorted(schema_files):
        if process_schema_file(schema_file):
            success_count += 1
    
    print(f"\n完成! 成功处理 {success_count}/{len(schema_files)} 个文件")

if __name__ == '__main__':
    main()
