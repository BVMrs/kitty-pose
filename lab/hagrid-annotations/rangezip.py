# List (and optionally extract) members of a remote zip via HTTP Range, without downloading all of it.
import io, sys, urllib.request, zipfile
class R(io.RawIOBase):
    def __init__(s,u):
        s.u=u; s.pos=0; s.n=int(urllib.request.urlopen(urllib.request.Request(u,method="HEAD")).headers["Content-Length"]); s.bytes=0
    def seekable(s): return True
    def readable(s): return True
    def tell(s): return s.pos
    def seek(s,o,w=0):
        s.pos={0:o,1:s.pos+o,2:s.n+o}[w]; return s.pos
    def readinto(s,b):
        if s.pos>=s.n: return 0
        e=min(s.pos+len(b),s.n)-1
        r=urllib.request.Request(s.u,headers={"Range":f"bytes={s.pos}-{e}"})
        d=urllib.request.urlopen(r).read(); b[:len(d)]=d; s.pos+=len(d); s.bytes+=len(d); return len(d)
if __name__=="__main__":
    u=sys.argv[1]; r=R(u); z=zipfile.ZipFile(io.BufferedReader(r,1<<20))
    tot={}
    for i in z.infolist():
        sp=i.filename.split("/")[0:-1]; k="/".join(sp)
        a=tot.setdefault(k,[0,0,0]); a[0]+=1; a[1]+=i.compress_size; a[2]+=i.file_size
        if len(sys.argv)>2 and k.endswith(sys.argv[2]) and i.filename.endswith(".json"):
            import os; os.makedirs(os.path.dirname(sys.argv[3]+"/"+i.filename),exist_ok=True)
            open(sys.argv[3]+"/"+i.filename,"wb").write(z.read(i))
    for k,v in tot.items(): print(k,v)
    print("fetched bytes",r.bytes)
