"""Profile photo REST acceptance: isolated localhost database and captured email only."""
import json,re,time,uuid
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from urllib.request import Request,urlopen
from urllib.error import HTTPError
BASE='http://localhost:3027/api'
OUT=Path('/tmp/quadem-team-completion-evidence')
ADMIN=json.loads((OUT/'trusted-device-fixture.json').read_text())
assert ADMIN['email'].endswith('@example.test')
def call(path,data=None,token=None,method=None,raw=None,content='application/json'):
 req=Request(BASE+path,data=raw if raw is not None else json.dumps(data).encode() if data is not None else None,headers={'Content-Type':content,**({'Authorization':'JWT '+token} if token else {})},method=method)
 try:r=urlopen(req,timeout=45)
 except HTTPError as e:r=e
 body=r.read()
 try:body=json.loads(body)
 except (ValueError,UnicodeDecodeError):pass
 return r.status,body

def login(email,password):
 assert email.endswith('@example.test')
 data={'email':email,'password':password}
 status,result=call('/users/login',data)
 if status==428:
  challenge=result['errors'][0]['data']['securityChallenge']
  mail=[json.loads(line) for line in Path('/tmp/quadem-team-local-email.jsonl').read_text().splitlines() if email in line][-1]
  code=re.search(r'code is (\d{6})',mail['text'])[1]
  status,result=call('/users/login',{**data,'securityChallenge':challenge,'securityCode':code})
 assert status==200,(status,result)
 return result['token']
admin=login(ADMIN['email'],ADMIN['password'])
stamp=str(int(time.time()));password='Sample-Photo-2026!'
def person(label,role='team'):
 status,result=call('/users',{'email':f'photos-{label}-{stamp}@example.test','name':f'QA Photo {label.title()}','password':password,'role':role,'status':'active','country':'NG','notifyBy':'portal'},admin)
 assert status in (200,201),(status,result)
 user=result['doc']; return user,login(user['email'],password)
member,token=person('member');other,other_token=person('other');editor,editor_token=person('editor','editor');site,site_token=person('site','site')
photo=(OUT/'photo-sample.jpg').read_bytes()
def upload(token,bytes=photo,mime='image/jpeg',extra='',path='/users/profile-photo'):
 boundary='test-photo-'+str(uuid.uuid4())
 raw=(f'--{boundary}\r\nContent-Disposition: form-data; name="file"; filename="photo.jpg"\r\nContent-Type: {mime}\r\n\r\n'.encode()+bytes+f'\r\n--{boundary}\r\nContent-Disposition: form-data; name="_payload"\r\n\r\n{extra or "{}"}\r\n--{boundary}--\r\n'.encode())
 return call(path,token=token,method='POST',raw=raw,content='multipart/form-data; boundary='+boundary)
def me(jwt):
 status,result=call('/users/me?depth=0',token=jwt);assert status==200;return result['user']
def photo_doc(id,jwt=token):
 return call(f'/profile-photos/{id}?depth=0',token=jwt)
checks=[]
for jwt in (None,editor_token,site_token):
 assert upload(jwt)[0] in (401,403)
 assert call('/users/profile-photo',token=jwt,method='DELETE')[0] in (401,403)
checks.append('Anonymous, website and editor cannot change team photos')
assert upload(token,path='/profile-photos')[0] in (401,403)
assert call('/profile-photos',token=None)[0] in (401,403)
checks.append('Direct collection upload and anonymous list denied')
# Detaching an existing public avatar must never delete shared website media.
status,legacy=upload(admin,path='/media',extra=json.dumps({'alt':'Local QA legacy avatar'}));assert status==201,(status,legacy)
legacy_id=legacy['doc']['id']
assert call(f'/users/{member['id']}',{'avatar':legacy_id},admin,method='PATCH')[0]==200
assert call('/users/profile-photo',token=token,method='DELETE')[0]==200
assert not me(token).get('avatar') and call(f'/media/{legacy_id}')[0]==200
checks.append('Removing legacy avatar leaves its public media record intact')
status,result=upload(token,extra=json.dumps({'owner':other['id'],'id':other['id']}));assert status==200,(status,result)
first=result['photoId'];assert me(token)['profilePhoto']==first;assert not me(other_token).get('profilePhoto')
status,doc=photo_doc(first);assert status==200;assert doc['owner']==member['id'];assert doc['mimeType']=='image/webp';assert doc['width']==512 and doc['height']==512
file_path='/profile-photos/file/'+doc['filename']
for jwt in (None,editor_token,site_token):assert call(file_path,token=jwt)[0] in (401,403,404)
assert call(file_path,token=other_token)[0]==200
checks.append('Upload belongs to caller; 512px WebP accessible only to signed-in team')
for data,mime in ((b'not an image','image/jpeg'),(b'<svg/>','image/png'),(photo,'text/html'),(b'','image/jpeg'),(b'x'*(4*1024*1024+1),'image/jpeg')):
 status,result=upload(token,data,mime);assert status==400,(status,result)
 assert me(token)['profilePhoto']==first
checks.append('Spoofed, corrupt, empty, oversized and unsupported files preserve saved photo')
status,result=call(f'/users/{other["id"]}',{'profilePhoto':first},token,method='PATCH');assert status in (403,404)
status,result=call(f'/users/{member["id"]}',{'profilePhoto':None,'role':'admin'},token,method='PATCH');assert status==200
assert me(token)['profilePhoto']==first and me(token)['role']=='team'
assert call(f'/profile-photos/{first}',{'owner':other['id']},token,method='PATCH')[0] in (403,404)
assert call(f'/profile-photos/{first}',token=token,method='DELETE')[0] in (403,404)
checks.append('No account escalation, cross-account write, photo reassignment or direct deletion')
status,result=upload(token);assert status==200,(status,result)
second=result['photoId'];assert second!=first;assert photo_doc(first)[0]==404;assert call(file_path,token=token)[0]>=400
assert not (Path('.next/standalone/profile-photos')/doc['filename']).exists()
checks.append('Replacement removes predecessor record and file')
with ThreadPoolExecutor(max_workers=2) as pool:results=list(pool.map(lambda _:upload(token),range(2)))
assert all(s==200 for s,r in results),results
status,result=call(f'/profile-photos?where[owner][equals]={member["id"]}&depth=0',token=token)
assert result['totalDocs']==1,result
assert result['docs'][0]['id']==me(token)['profilePhoto']
checks.append('Concurrent saves leave one current photo and clean up both predecessors')
status,result=call('/users/profile-photo',token=token,method='DELETE');assert status==200
assert not me(token).get('profilePhoto')
status,result=call(f'/profile-photos?where[owner][equals]={member["id"]}',token=token);assert result['totalDocs']==0
assert call('/users/profile-photo',token=token,method='DELETE')[0]==200
checks.append('Remove clears the photo and is safe to repeat')
# Private deletion cleanup when a sample account is deleted.
status,result=upload(other_token);assert status==200;deleted=result['photoId']
status,result=call(f'/users/{other["id"]}',token=admin,method='DELETE');assert status==200,(status,result)
assert photo_doc(deleted)[0]==404
checks.append('Deleting an account cleans up its private photo')
status,result=upload(admin);assert status==200,(status,result)
checks.append('Founder can upload their own photo')
fixture={'memberToken':token,'memberId':member['id'],'adminToken':admin,'adminId':ADMIN['id']}
f=OUT/'photo-fixture.json';f.write_text(json.dumps(fixture));f.chmod(0o600)
(OUT/'photo-api-checks.json').write_text(json.dumps({'passed':True,'groups':len(checks),'checks':checks},indent=2))
print(f'PASS: {len(checks)} profile-photo API acceptance groups')
