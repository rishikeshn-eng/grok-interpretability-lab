"""Turn grok_ck.pkl (from train.py) into the site's data files: grok.json, frames.bin, final.bin, grids.bin."""
import pickle, numpy as np, json
D = pickle.load(open('grok_ck.pkl', 'rb')); CK = D['ck']; p = D['p']; N = D['N']; tr = D['tr']
log = np.load('grok_log.npy'); steps = sorted(CK)
Wa, Wb, W2 = CK[steps[-1]]
pw = np.abs(np.fft.rfft(Wa, axis=1)[:, 1:]) ** 2
dom = pw.argmax(1) + 1; frac = pw.max(1) / pw.sum(1); nord = np.lexsort((-frac, dom))
q = lambda A: (np.clip(np.round(A / np.abs(A).max() * 127), -127, 127).astype(np.int8), float(np.abs(A).max() / 127))
series, frames, blob = [], [], b''
for s in steps:
    a, b, c = CK[s]; P = np.abs(np.fft.rfft(a, axis=1)[:, 1:]) ** 2
    series.append({'s': s, 'purity': float(np.median(P.max(1) / P.sum(1))), 'norm': float(np.sqrt((a**2).sum() + (b**2).sum() + (c**2).sum()))})
    qq, sc = q(a[nord]); frames.append({'s': s, 'sc': sc, 'off': len(blob)}); blob += qq.tobytes()
open('frames.bin', 'wb').write(blob)
fin, finq = b'', {}
for nm, A in [('Wa', Wa), ('Wb', Wb), ('W2', W2)]:
    qq, sc = q(A); finq[nm] = {'sc': sc, 'off': len(fin), 'shape': list(A.shape)}; fin += qq.tobytes()
open('final.bin', 'wb').write(fin)
aa, bb = np.meshgrid(np.arange(p), np.arange(p), indexing='ij'); aa = aa.ravel(); bb = bb.ravel(); y = (aa + bb) % p; g = b''
for s in steps:
    A, B, C2 = CK[s]; pr = (C2 @ np.maximum(A[:, aa] + B[:, bb], 0)).argmax(0); g += np.packbits((pr == y).astype(np.uint8)).tobytes()
open('grids.bin', 'wb').write(g)
ts = np.zeros(p * p, np.uint8); ts[tr] = 1
json.dump({'p': p, 'N': N, 'steps': steps, 'log': log.round(5).tolist(), 'series': series, 'frames': frames, 'final': finq, 'dom': dom.tolist(), 'domFrac': frac.round(3).tolist(), 'nord': nord.tolist(), 'train': ts.tolist()}, open('grok.json', 'w'), separators=(',', ':'))
