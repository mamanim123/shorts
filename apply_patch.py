import sys

file_path = 'youtube-shorts-script-generator.tsx'
patch_path = 'youtube-shorts-script-generator_patch.tsx'

with open(file_path, 'r', encoding='utf-8') as f:
    lines = f.readlines()

with open(patch_path, 'r', encoding='utf-8') as f:
    patch_content = f.read()

start_line = -1
end_line = -1

for i, line in enumerate(lines):
    if 'const enforceKoreanIdentity =' in line:
        start_line = i
        brace_depth = 0
        for j in range(i, len(lines)):
            brace_depth += lines[j].count('{')
            brace_depth -= lines[j].count('}')
            if brace_depth == 0 and j > i:
                end_line = j + 1
                break
        break

if start_line != -1 and end_line != -1:
    new_lines = lines[:start_line] + [patch_content + '\n'] + lines[end_line:]
    with open(file_path, 'w', encoding='utf-8') as f:
        f.writelines(new_lines)
    print("Patch applied successfully")
else:
    print("Could not find function to patch")
