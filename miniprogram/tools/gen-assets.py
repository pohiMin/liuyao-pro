"""从小程序 WXML 所需的资源清单生成 PNG（WXSS 不支持内联 SVG）。

龟壳与铜钱的 SVG 直接取自 Web 版 divine.js 的 initShell() / coinSVG()，
保证两端视觉一致。这里只做格式转换，不改图形。
"""
import pathlib
import re
import cairosvg

ROOT = pathlib.Path(__file__).resolve().parents[2]   # liuyao-coin/
ASSETS = ROOT / 'miniprogram' / 'assets'
ASSETS.mkdir(parents=True, exist_ok=True)

SHELL_SVG = '''<svg viewBox="0 0 300 300" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <radialGradient id="shellGrad" cx="38%" cy="28%" r="78%">
      <stop offset="0%" stop-color="#a5825c"/>
      <stop offset="45%" stop-color="#7d5f42"/>
      <stop offset="82%" stop-color="#5a4430"/>
      <stop offset="100%" stop-color="#3d2d1e"/>
    </radialGradient>
    <linearGradient id="shellSheen" x1="0" y1="0" x2="0.4" y2="1">
      <stop offset="0%" stop-color="#e8c877" stop-opacity="0.20"/>
      <stop offset="50%" stop-color="#e8c877" stop-opacity="0.03"/>
      <stop offset="100%" stop-color="#e8c877" stop-opacity="0.10"/>
    </linearGradient>
  </defs>
  <ellipse cx="150" cy="150" rx="132" ry="140" fill="url(#shellGrad)" stroke="#2e2114" stroke-width="3.5"/>
  <ellipse cx="150" cy="150" rx="126" ry="134" fill="none" stroke="#c9a24a" stroke-width="1" opacity="0.25"/>
  <g stroke="#33241a" stroke-width="2" fill="none" opacity="0.72">
    <path d="M34,104 L150,78 L266,104 L150,130 Z"/>
    <path d="M34,196 L150,170 L266,196 L150,222 Z"/>
  </g>
  <g stroke="#33241a" stroke-width="1.8" fill="rgba(40,28,18,0.20)">
    VEES
  </g>
  <circle cx="150" cy="150" r="74" fill="none" stroke="#33241a" stroke-width="2.4" opacity="0.6"/>
  <circle cx="150" cy="150" r="40" fill="rgba(30,20,12,0.35)" stroke="#c9a24a" stroke-width="1.6" opacity="0.9"/>
  <g class="shell-center">
    <circle cx="150" cy="150" r="27" fill="none" stroke="#c9a24a" stroke-width="1.8" opacity="0.75"/>
    <path d="M150 123 A27 27 0 0 0 150 177 Z" fill="#c9a24a" opacity="0.42"/>
    <path d="M150 123 A27 27 0 0 1 150 177 Z" fill="rgba(28,18,9,0.55)"/>
    <path d="M150 123 A13.5 13.5 0 0 0 150 150 A13.5 13.5 0 0 1 150 177"
          fill="none" stroke="#c9a24a" stroke-width="1.6" opacity="0.85"/>
    <circle cx="150" cy="136.5" r="4.2" fill="#1c1209"/>
    <circle cx="150" cy="163.5" r="4.2" fill="#e8c877"/>
  </g>
  <g fill="#e8c877" opacity="0.7" font-size="14" text-anchor="middle" font-family="Noto Serif CJK SC" font-weight="bold">
    <text x="150" y="34">乾</text>
    <text x="240" y="84">兑</text>
    <text x="240" y="212">离</text>
    <text x="150" y="258">震</text>
    <text x="60" y="212">巽</text>
    <text x="60" y="84">坎</text>
    <text x="40" y="152">艮</text>
    <text x="260" y="152">坤</text>
  </g>
  <ellipse cx="150" cy="150" rx="132" ry="140" fill="url(#shellSheen)"/>
  <ellipse cx="112" cy="88" rx="52" ry="34" fill="#fff" opacity="0.05" transform="rotate(-24 112 88)"/>
</svg>'''

COIN_SVG = '''<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <radialGradient id="cg{IDX}" cx="34%" cy="28%" r="76%">
      <stop offset="0%" stop-color="#f2dc9b"/>
      <stop offset="34%" stop-color="#d9b962"/>
      <stop offset="72%" stop-color="#a8853093"/>
      <stop offset="92%" stop-color="#7d6220"/>
      <stop offset="100%" stop-color="#5c4a17"/>
    </radialGradient>
    <linearGradient id="rim{IDX}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#e8c877"/>
      <stop offset="50%" stop-color="#b08f38"/>
      <stop offset="100%" stop-color="#6d5719"/>
    </linearGradient>
    <linearGradient id="hol{IDX}" x1="0" y1="0" x2="0.6" y2="1">
      <stop offset="0%" stop-color="#0d0904"/>
      <stop offset="100%" stop-color="#2a2010"/>
    </linearGradient>
  </defs>
  <circle cx="50" cy="50" r="47" fill="#4a3a12"/>
  <circle cx="50" cy="50" r="45" fill="url(#cg{IDX})"/>
  <circle cx="50" cy="50" r="45" fill="none" stroke="url(#rim{IDX})" stroke-width="2.4"/>
  <circle cx="50" cy="50" r="40" fill="none" stroke="#6b5316" stroke-width="0.9" opacity="0.55"/>
  <rect x="36.5" y="36.5" width="27" height="27" rx="1.5" fill="url(#hol{IDX})" stroke="url(#rim{IDX})" stroke-width="2.6"/>
  <g fill="#4a3810" font-size="12.5" text-anchor="middle" font-weight="bold" font-family="Noto Serif CJK SC">
    <text x="50" y="30">乾</text>
    <text x="71" y="54">隆</text>
    <text x="50" y="79">通</text>
    <text x="29" y="54">寶</text>
  </g>
</svg>'''

# 龟甲纹：与 Web 版 initShell() 的六边形放射线一致
vees = []
for i in range(6):
    a1 = (i * 60 - 90) * 3.141592653589793 / 180
    a2 = ((i + 1) * 60 - 90) * 3.141592653589793 / 180
    R, r = 116, 74
    x1, y1 = 150 + R * __import__('math').cos(a1), 150 + R * __import__('math').sin(a1)
    x2, y2 = 150 + R * __import__('math').cos(a2), 150 + R * __import__('math').sin(a2)
    ix1, iy1 = 150 + r * __import__('math').cos(a1), 150 + r * __import__('math').sin(a1)
    ix2, iy2 = 150 + r * __import__('math').cos(a2), 150 + r * __import__('math').sin(a2)
    vees.append(f'<path d="M{ix1:.1f},{iy1:.1f} L{x1:.1f},{y1:.1f} L{x2:.1f},{y2:.1f} L{ix2:.1f},{iy2:.1f} Z" />')

shell_svg = SHELL_SVG.replace('VEES', '\n    '.join(vees))
cairosvg.svg2png(bytestring=shell_svg.encode('utf-8'),
                 write_to=str(ASSETS / 'shell.png'), output_width=420, output_height=420)
print('生成 shell.png (420×420)')

for i in range(3):
    cairosvg.svg2png(bytestring=COIN_SVG.replace('{IDX}', str(i)).encode('utf-8'),
                     write_to=str(ASSETS / f'coin-{i}.png'), output_width=184, output_height=184)
print('生成 coin-0/1/2.png (184×184)')

for f in sorted(ASSETS.glob('*.png')):
    print(f'  {f.name}: {f.stat().st_size} bytes')
