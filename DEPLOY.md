# คู่มือ Deploy ระบบจองห้องประชุมบน Synology NAS (PocketBase)

ระบบนี้ย้ายจาก Firebase มาเป็น **PocketBase** ที่รันเองบน Synology NAS ของคุณ — ไม่ต้องผูกบัตรเครดิต ไม่ต้องพึ่ง cloud ภายนอกเลย ทำตามขั้นตอนนี้ทีละข้อ

## สิ่งที่ต้องมีก่อนเริ่ม
- Synology NAS ที่รองรับ **Container Manager** (DSM 7.0 ขึ้นไป)
- เข้าถึงหน้า Router เพื่อตั้งค่า port forwarding (ถ้าต้องการใช้งานนอกออฟฟิศ)
- อีเมลสักบัญชี (เช่น Gmail) สำหรับตั้งค่าส่งอีเมลจริง

---

## ขั้นตอนที่ 1: ติดตั้ง Container Manager

1. เปิด **Package Center** บน DSM
2. ค้นหา "Container Manager" แล้วติดตั้ง

## ขั้นตอนที่ 2: คัดลอกโฟลเดอร์โปรเจกต์ไปที่ NAS

1. เปิด **File Station** บน NAS สร้าง shared folder ใหม่ชื่อ เช่น `villa-carte-booking`
2. คัดลอกทั้งโฟลเดอร์โปรเจกต์นี้ (หรืออย่างน้อยโฟลเดอร์ `pocketbase/`, `pb_migrations/`, `pb_hooks/`) ไปไว้ใน shared folder นั้น — จะ map ผ่าน network drive หรือลาก-วางผ่าน File Station ก็ได้
3. โครงสร้างบน NAS ควรได้ประมาณนี้:
   ```
   /volume1/villa-carte-booking/
     pocketbase/docker-compose.yml
     pocketbase/pb_data/       (ว่างเปล่า สร้างอัตโนมัติ)
     pocketbase/pb_public/     (จะใส่ไฟล์แอปทีหลังในขั้นตอนที่ 8)
     pb_migrations/1_init_collections.js
     pb_hooks/sendBookingEmail.pb.js
   ```

## ขั้นตอนที่ 3: รัน PocketBase container

1. เปิด **Container Manager** → แท็บ **Project** → **Create**
2. ตั้งชื่อโปรเจกต์ เช่น `villa-carte-booking`
3. เลือก path ไปที่โฟลเดอร์ที่มี `pocketbase/docker-compose.yml` (หรือวางเนื้อหาไฟล์นั้นในช่อง compose โดยตรง)
4. กด **Done** / **สร้าง** — Container Manager จะดึง image และเริ่มรันให้อัตโนมัติ
5. รอสักครู่แล้วเช็คว่า container สถานะ "Running"

## ขั้นตอนที่ 4: ตั้งค่าบัญชีแอดมิน PocketBase ครั้งแรก

1. เปิดเบราว์เซอร์ไปที่ `http://<IP ของ NAS>:8090/_/`
2. กรอกอีเมล/รหัสผ่านเพื่อสร้างบัญชีแอดมิน (แนะนำใช้อีเมลของคุณเอง ไม่ใช่อีเมลพนักงาน)
3. เข้าหน้า Admin UI สำเร็จ → เช็คเมนู **Collections** ควรเห็น `bookings` และ `emailNotifications` ถูกสร้างไว้แล้วอัตโนมัติ (มาจาก `pb_migrations/1_init_collections.js`) — ถ้ายังไม่เห็น ลอง restart container อีกครั้ง

## ขั้นตอนที่ 5: ตั้งค่า Google Sign-In (OAuth Client ใหม่ — ฟรี ไม่ต้องผูกบัตร)

1. ไปที่ [Google Cloud Console](https://console.cloud.google.com/) → สร้างโปรเจกต์ใหม่ (หรือใช้โปรเจกต์เดิม `gen-lang-client-0226184764` ก็ได้ เพราะขั้นตอนนี้ไม่แตะ Firestore)
2. ไปที่ **APIs & Services → Credentials → Create Credentials → OAuth Client ID**
3. Application type: **Web application**
4. Authorized redirect URI: `https://booking.<ชื่อคุณ>.synology.me/api/oauth2-redirect` (หรือ `http://<IP NAS>:8090/api/oauth2-redirect` ถ้ายังทดสอบในวง LAN ก่อน)
5. คัดลอก **Client ID** และ **Client Secret**
6. กลับไปที่ PocketBase Admin UI → **Settings → Auth providers → Google** → เปิดใช้งาน แล้ววาง Client ID/Secret ที่ได้

## ขั้นตอนที่ 6: ตั้งค่าส่งอีเมลจริง (SMTP)

1. PocketBase Admin UI → **Settings → Mail settings**
2. เปิด "Enable SMTP mail" แล้วกรอกข้อมูล SMTP ของอีเมลที่มีอยู่ เช่น Gmail:
   - SMTP host: `smtp.gmail.com`, port `587`
   - Username: อีเมล Gmail ของคุณ
   - Password: **App Password** (สร้างได้ที่ [Google Account → Security → App Passwords](https://myaccount.google.com/apppasswords) — ต้องเปิด 2-Step Verification ก่อน)
3. Save — จากนี้ทุกการจอง/ยกเลิกจะส่งอีเมลจริงผ่าน `pb_hooks/sendBookingEmail.pb.js` ที่เตรียมไว้ให้แล้ว

## ขั้นตอนที่ 7: เปิดให้ใช้งานนอกออฟฟิศ (DDNS + HTTPS)

1. **DDNS**: Control Panel → External Access → DDNS → Add → เลือก synology.me ตั้งชื่อ hostname (ฟรี)
2. **SSL Certificate**: Control Panel → Security → Certificate → Add → Let's Encrypt (ฟรี ต่ออายุอัตโนมัติ) ผูกกับ hostname ที่ได้จากข้อ 1
3. **Reverse Proxy**: Control Panel → Login Portal → Advanced → Reverse Proxy → Create
   - Source: `https://booking.<ชื่อคุณ>.synology.me` พอร์ต 443
   - Destination: `http://localhost:8090`
4. **Router**: forward พอร์ต 443 (และ 80 สำหรับต่ออายุ cert) ไปยัง IP ของ NAS ในวง LAN

## ขั้นตอนที่ 8: Build และอัปโหลดตัวแอป React

จากเครื่องที่มีโปรเจกต์นี้ (เช่น พีซีที่ใช้พัฒนา):

```bash
npm run build:pb
```

คำสั่งนี้จะ build แอปแล้วคัดลอกไปไว้ที่ `pocketbase/pb_public/` อัตโนมัติ จากนั้น **sync โฟลเดอร์ `pocketbase/pb_public/` ทั้งหมดไปทับที่ NAS** (path เดียวกับที่ตั้งไว้ตอน docker-compose) แล้ว restart container ใน Container Manager หนึ่งครั้ง

จากนี้ไปเข้าเว็บที่ `https://booking.<ชื่อคุณ>.synology.me` จะเห็นทั้งหน้าแอปและ API มาจากที่เดียวกัน

## ทดสอบว่าใช้งานได้จริง

- [ ] เข้า URL แล้วเห็นหน้า sign-in ของแอป (ไม่ใช่หน้า PocketBase Admin)
- [ ] ล็อกอินด้วย Google ได้ (ต้องเป็นอีเมล @villacartegroup.com)
- [ ] ล็อกอิน/สมัครด้วยอีเมล+รหัสผ่านได้ (ยกเว้นอีเมลแอดมินที่ต้องใช้ Google เท่านั้น)
- [ ] จองห้องแล้วเห็นข้อมูลจริงใน PocketBase Admin UI → Collections → bookings
- [ ] เปิด 2 browser tab จองห้อง ดูอีกแท็บอัปเดตแบบเรียลไทม์
- [ ] ได้รับอีเมลจริงหลังจอง (เช็ค PocketBase Admin UI → emailNotifications → ดู field `emailSent`/`emailError` ถ้าส่งไม่สำเร็จจะมีรายละเอียด error ตรงนั้น)
- [ ] เข้าจากมือถือนอก WiFi ออฟฟิศได้ (ทดสอบผ่าน 4G/5G)

## ถ้าเจอปัญหา

- **Google Sign-In ขึ้น error**: เช็ค redirect URI ใน Google Cloud Console ตรงกับ URL จริงเป๊ะ (รวม https/http, path `/api/oauth2-redirect`)
- **ล็อกอินแล้วเด้งกลับหน้า sign-in ทันที**: เช็ค `pb_migrations` apply สำเร็จหรือยัง (Admin UI → Collections → users → ดู tab "Create rule" ว่าถูกแก้ตามที่ตั้งใจ)
- **ไม่ได้รับอีเมล**: เช็ค Admin UI → emailNotifications → record ล่าสุด → field `emailError` จะบอกสาเหตุ (เช่น App Password ผิด, SMTP port ถูกบล็อก)
- **เข้าจากนอกออฟฟิศไม่ได้**: เช็คว่า router forward พอร์ต 443 ไปที่ NAS ถูกเครื่อง และ reverse proxy ชี้ไปที่ `localhost:8090` ถูกต้อง

---

## ขั้นตอนที่ 9: Auto Deploy ผ่าน SSH (ทางเลือก แนะนำ)

แทนที่จะต้อง build → ลาก-วางไฟล์ผ่าน File Station → กด Restart ใน Container Manager เอง ทุกครั้งที่แก้โค้ด สคริปต์ `npm run deploy` ทำทั้งหมดนี้ให้อัตโนมัติในคำสั่งเดียว: **type-check → build → อัปโหลดไฟล์ → restart container ผ่าน SSH โดยตรง (ข้าม Container Manager UI ที่เคยมีบั๊ก "Container undefined does not exist") → เช็คว่าเว็บขึ้นจริงหลัง deploy**

ตั้งค่าครั้งเดียวตามนี้:

### 9.1 เปิดใช้งาน SSH บน NAS

Control Panel → **Terminal & SNMP** → ติ๊ก "Enable SSH service" → Apply (จด **port** ที่ใช้ไว้ ปกติคือ `22`)

### 9.2 อนุญาต SSH key สำหรับ deploy

มีการสร้าง SSH key สำหรับ deploy อัตโนมัติไว้ให้แล้วที่เครื่องนี้ (`~/.ssh/vcg_booking_deploy` / `.pub`) — ไม่มีรหัสผ่านป้องกัน (เพื่อให้สคริปต์รันได้เองโดยไม่ต้องพิมพ์รหัสทุกครั้ง) จึงต้องนำ **public key** ไปอนุญาตไว้บน NAS ก่อน:

**Public key ที่ต้องนำไปวาง:**
```
ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIBQ6THzMuS8dWCPZ0vOu8PqvJ69yWURANKeT7wLHfQZ3 vcg-booking-deploy
```

วิธีติดตั้ง (เลือกวิธีใดวิธีหนึ่ง):

- **วิธี A — ผ่าน File Station**: เปิด File Station → ไปที่โฟลเดอร์ home ของบัญชีที่จะใช้ SSH (เช่น `/homes/<username>/`) → เปิดการแสดงไฟล์ซ่อน → เข้าโฟลเดอร์ `.ssh` (ถ้าไม่มีให้สร้างขึ้นมา) → เปิด/สร้างไฟล์ `authorized_keys` → วางบรรทัด public key ด้านบนต่อท้ายไฟล์ (ถ้ามีบรรทัดอื่นอยู่แล้ว ให้ขึ้นบรรทัดใหม่ ห้ามทับของเดิม) → บันทึก
- **วิธี B — SSH เข้าไปเองครั้งเดียวด้วยรหัสผ่าน**: เปิด Terminal/PowerShell บนเครื่องนี้ พิมพ์ `ssh <username>@<NAS-IP>` ใส่รหัสผ่าน DSM ของคุณเอง (พิมพ์เอง ไม่ใช่ให้ Claude พิมพ์) แล้วรันคำสั่งนี้บน NAS:
  ```bash
  mkdir -p ~/.ssh && echo "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIBQ6THzMuS8dWCPZ0vOu8PqvJ69yWURANKeT7wLHfQZ3 vcg-booking-deploy" >> ~/.ssh/authorized_keys && chmod 700 ~/.ssh && chmod 600 ~/.ssh/authorized_keys
  ```

### 9.3 ตั้งค่า `deploy.config.json`

**ตัดสินใจแล้วว่าจะรัน deploy เฉพาะตอนอยู่ในออฟฟิศ (ต่อ WiFi/LAN เดียวกับ NAS) เท่านั้น — ไม่เปิด SSH ออกสู่อินเทอร์เน็ตภายนอกเลย** (ปลอดภัยกว่า เพราะ SSH ที่เปิดสู่อินเทอร์เน็ตตรงๆ มักโดนบอทสแกน/บรูทฟอร์ซตลอดเวลา) ดังนั้น `nasHost` ต้องเป็น **IP ภายในวง LAN ของ NAS** ไม่ใช่ชื่อโดเมนสาธารณะ

แก้ไฟล์ `deploy.config.json` ที่ root โปรเจกต์ ใส่ค่าจริงของคุณ:

```json
{
  "nasHost": "192.168.1.124",
  "nasPort": 22,
  "nasUser": "your-dsm-username",
  "remotePath": "/volume1/docker/villa-carte-booking",
  "sshKeyPath": "~/.ssh/vcg_booking_deploy",
  "siteUrl": "https://vcgaccounting.synology.me"
}
```

- `nasHost`: IP ภายในของ NAS (เช็คได้จาก Control Panel → Info Center หรือหน้า router) — ใช้ได้เฉพาะตอนเครื่องที่รัน `npm run deploy` ต่ออยู่กับ WiFi/LAN เดียวกับ NAS เท่านั้น
- `nasUser`: บัญชี DSM ที่ authorized_keys ของมันมี public key ด้านบนอยู่ (ข้อ 9.2)
- `remotePath`: path ของโฟลเดอร์โปรเจกต์บน NAS ที่มี `pb_data/`, `pb_migrations/`, `pb_hooks/`, `pb_public/`, `docker-compose.yml` อยู่ด้วยกัน (เช็คได้จาก Container Manager → Project → Settings)
- `siteUrl`: ปล่อยเป็นโดเมนสาธารณะได้ตามเดิม (ใช้แค่เช็คว่าเว็บขึ้นจริงหลัง deploy ไม่เกี่ยวกับ SSH)

### 9.5 อนุญาต sudo แบบไม่ต้องรหัสผ่านสำหรับคำสั่ง `docker` (จำเป็น)

`docker.sock` บน NAS นี้เป็นของ `root` เท่านั้น (`srw-rw---- root root`) บัญชี DSM ทั่วไป (แม้จะอยู่ใน administrators group) **ไม่สามารถรัน `docker compose restart` ได้โดยตรง** ต้องผ่าน `sudo` — แต่สคริปต์รันแบบไม่โต้ตอบ (ไม่มีหน้าจอให้พิมพ์รหัส) จึงต้องตั้ง sudo ให้ไม่ถามรหัสผ่าน **เฉพาะคำสั่ง `docker`** (ไม่ใช่ sudo ทั้งระบบ)

SSH เข้า NAS ด้วยบัญชีที่จะใช้ deploy (ข้อ 9.2) แล้วรันทีละคำสั่ง (จะถามรหัสผ่านตอน `sudo` แค่ครั้งแรก):

```bash
echo 'admin ALL=(root) NOPASSWD: /usr/local/bin/docker' > /tmp/vcg-deploy-docker
```
(แก้ `admin` เป็นชื่อบัญชีจริงที่ใช้ ถ้าไม่ใช่ `admin`)

```bash
sudo cp /tmp/vcg-deploy-docker /etc/sudoers.d/vcg-deploy-docker
sudo chown root:root /etc/sudoers.d/vcg-deploy-docker
sudo chmod 440 /etc/sudoers.d/vcg-deploy-docker
rm /tmp/vcg-deploy-docker
```

ทดสอบว่าใช้ได้ (ต้อง**ไม่**ถามรหัสผ่านอีก):
```bash
sudo /usr/local/bin/docker compose version
```

> หมายเหตุ: NAS นี้ไม่มี `visudo` (พบได้บ่อยใน DSM) จึงข้ามการตรวจ syntax ก่อนติดตั้งไปได้ — ไฟล์นี้เป็น drop-in แยกใน `sudoers.d/` ถ้าเขียนผิดพลาดจริงๆ แค่ลบไฟล์ `/etc/sudoers.d/vcg-deploy-docker` ทิ้งก็กลับมาเป็นปกติ ไม่กระทบ `/etc/sudoers` หลัก

### 9.6 ใช้งาน

**สำคัญ: ต้องต่อ WiFi/LAN ของออฟฟิศก่อนรันคำสั่งนี้เสมอ** (เพราะ SSH เข้าถึงได้แค่ในวงเน็ตเดียวกับ NAS) จากนี้ทุกครั้งที่แก้โค้ดเสร็จ รันคำสั่งเดียว:

```bash
npm run deploy
```

สคริปต์จะ: (1) `tsc --noEmit` เช็ค type error ก่อน หยุดทันทีถ้าพัง (2) build แอปจริง (3) ลบ `pb_public` เก่าบน NAS แล้วอัปโหลดของใหม่ทับ + อัปโหลด `pb_migrations`/`pb_hooks` ผ่าน `scp -O` (โปรโตคอล SCP แบบเก่า — NAS นี้ไม่ได้เปิด SFTP subsystem ไว้ scp ปกติจะขึ้น "subsystem request failed") (4) รัน `sudo docker compose restart` ผ่าน SSH — เร็วและนิ่งกว่าเมนู Container Manager (5) เช็คว่า `siteUrl` ตอบกลับ 200 จริงหลัง restart

ถ้าขั้นตอนไหนพัง สคริปต์จะหยุดทันทีพร้อมบอกสาเหตุ ไม่ทำขั้นต่อไปให้ (เช่น type error จะไม่ไป build/upload ต่อ)

ทดสอบแล้วรันสำเร็จจริงจบทั้ง 5 ขั้นตอนเมื่อ 25/8/2569 ✅
