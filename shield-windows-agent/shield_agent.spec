# -*- mode: python ; coding: utf-8 -*-
"""
PyInstaller spec for Shield Windows Agent.
Build:  pyinstaller shield_agent.spec
Output: dist/ShieldAgent/ShieldAgent.exe   (one-dir)
        dist/ShieldAgent-Setup.exe         (created by NSIS after)
"""

import sys, os

block_cipher = None

a = Analysis(
    ['main.py'],
    pathex=['.'],
    binaries=[],
    datas=[
        ('assets/shield-logo.ico', 'assets'),
    ],
    hiddenimports=[
        'win32service',
        'win32serviceutil',
        'win32event',
        'win32security',
        'win32crypt',
        'servicemanager',
        'cryptography',
        'cryptography.fernet',
        'cryptography.hazmat.primitives',
        'cryptography.hazmat.backends',
    ],
    hookspath=[],
    runtime_hooks=[],
    excludes=['tkinter', 'matplotlib', 'numpy', 'scipy', 'pandas'],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
    noarchive=False,
)

pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name='ShieldAgent',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    console=False,          # no console window for service
    icon='assets/shield-logo.ico',
    uac_admin=True,          # request UAC elevation on launch
    version='version_info.txt',
)

coll = COLLECT(
    exe,
    a.binaries,
    a.zipfiles,
    a.datas,
    strip=False,
    upx=True,
    upx_exclude=[],
    name='ShieldAgent',
)
