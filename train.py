import numpy as np, json, time, sys
p=97; N=int(sys.argv[1]) if len(sys.argv)>1 else 256; frac=0.3; steps=int(sys.argv[2]) if len(sys.argv)>2 else 30000
rng=np.random.default_rng(0)
pairs=np.array([(a,b) for a in range(p) for b in range(p)]); y=(pairs[:,0]+pairs[:,1])%p
perm=rng.permutation(len(pairs)); ntr=int(frac*len(pairs)); tr,te=perm[:ntr],perm[ntr:]
Wa=rng.normal(0,1/np.sqrt(p),(N,p)).astype(np.float32); Wb=rng.normal(0,1/np.sqrt(p),(N,p)).astype(np.float32)
W2=rng.normal(0,1/np.sqrt(N),(p,N)).astype(np.float32)
params=[Wa,Wb,W2]; m=[np.zeros_like(x) for x in params]; v=[np.zeros_like(x) for x in params]
lr=float(sys.argv[3]) if len(sys.argv)>3 else 1e-3; wd=float(sys.argv[4]) if len(sys.argv)>4 else 1.0; b1,b2=0.9,0.98
def fwd(idx):
    a,b=pairs[idx,0],pairs[idx,1]
    h=Wa[:,a]+Wb[:,b]; r=np.maximum(h,0); z=W2@r; return a,b,h,r,z
def lossacc(idx):
    _,_,_,_,z=fwd(idx); z=z-z.max(0); lp=z-np.log(np.exp(z).sum(0)); yy=y[idx]
    return float(-lp[yy,np.arange(len(idx))].mean()), float((z.argmax(0)==yy).mean())
OA=np.eye(p,dtype=np.float32)[pairs[tr,0]]; OB=np.eye(p,dtype=np.float32)[pairs[tr,1]]
ck=sorted(set([0]+[int(round(x/100)*100) for x in np.geomspace(100,steps,45)]+list(range(0,steps+1,1000))))
CK={}
log=[]; t0=time.time()
for s in range(steps+1):
    if s%100==0:
        ltr,atr=lossacc(tr); lte,ate=lossacc(te); log.append([s,ltr,atr,lte,ate])
        if s in ck: CK[s]=[Wa.copy(),Wb.copy(),W2.copy()]
        if s%2000==0: print(s,round(ltr,4),round(atr,3),round(lte,4),round(ate,3),round(time.time()-t0),flush=True)
    a,b,h,r,z=fwd(tr); z=z-z.max(0); P=np.exp(z); P/=P.sum(0); P[y[tr],np.arange(ntr)]-=1; dz=P/ntr
    gW2=dz@r.T; dr=W2.T@dz; dh=dr*(h>0)
    gWa=dh@OA; gWb=dh@OB
    for i,(P_,g) in enumerate(zip(params,[gWa,gWb,gW2])):
        m[i]=b1*m[i]+(1-b1)*g; v[i]=b2*v[i]+(1-b2)*g*g
        mh=m[i]/(1-b1**(s+1)); vh=v[i]/(1-b2**(s+1))
        P_-= lr*(mh/(np.sqrt(vh)+1e-8)+wd*P_)
np.save('grok_log.npy',np.array(log))
import pickle; pickle.dump({'ck':CK,'tr':tr,'te':te,'p':p,'N':N},open('grok_ck.pkl','wb'))
print('done')
