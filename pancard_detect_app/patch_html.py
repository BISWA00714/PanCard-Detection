with open('templates/index.html', 'r', encoding='utf-8') as f:
    html = f.read()

svg_defs = (
    '<svg width="0" height="0" style="position:absolute">'
    '<defs><linearGradient id="confGrad" x1="0%" y1="0%" x2="100%" y2="0%">'
    '<stop offset="0%" stop-color="#6c63ff"/>'
    '<stop offset="50%" stop-color="#9b8eff"/>'
    '<stop offset="100%" stop-color="#00e67a"/>'
    '</linearGradient></defs></svg>'
)

html = html.replace(
    '<canvas id="particles"></canvas>',
    '<canvas id="particles"></canvas>\n  ' + svg_defs,
    1
)

with open('templates/index.html', 'w', encoding='utf-8') as f:
    f.write(html)

print('HTML patched OK')
