# Diplomski
Tema: "Optimizacija prenosa podataka u racunarksim mrezama primenom kompresije"

Klijent i server implementirani u 2 odvojena JAVA projekta.
Klijent i server su dve odvojene masine ali povezane preko LANA-a.
Klijent meri vreme citanja podataka sa diska (PDF fajlovi velicina 5MB,30MB,100MB,200MB,500MB i 1GB)
Server meri vreme pisanja na disk (Random bitovi)

Klijent salje random bitove serveru i oba mere propustnost mreze u MB/s

Prvi rezultati

Client read test and TCP test:

File 5mb.pdf    | Time: 0.004 s | Throughput: 1458.81 MB/s<br>
File 30mb.pdf   | Time: 0.015 s | Throughput: 2009.07 MB/s<br>
File 100mb.pdf  | Time: 0.053 s | Throughput: 1896.62 MB/s<br>
File 200mb.pdf  | Time: 0.103 s | Throughput: 1949.04 MB/s<br>
File 500mb.pdf  | Time: 0.246 s | Throughput: 2035.27 MB/s<br>
File 1gb.pdf    | Time: 0.499 s | Throughput: 2052.15 MB/s<br>

Sent 5 MB | Time: 0.083 s | Throughput: 60.31 MB/s<br>
Sent 30 MB | Time: 0.639 s | Throughput: 46.96 MB/s<br>
Sent 100 MB | Time: 1.445 s | Throughput: 69.20 MB/s<br>
Sent 200 MB | Time: 7.707 s | Throughput: 25.95 MB/s<br>
Sent 500 MB | Time: 6.067 s | Throughput: 82.41 MB/s<br>
Sent 1024 MB | Time: 12.767 s | Throughput: 80.21 MB/s<br>

Server write test and TCP test:

Write    5 MB | Time: 0.007 s | Throughput: 679.73 MB/s<br>
Write   30 MB | Time: 0.034 s | Throughput: 888.22 MB/s<br>
Write  100 MB | Time: 0.107 s | Throughput: 938.30 MB/s<br>
Write  200 MB | Time: 0.212 s | Throughput: 943.24 MB/s<br>
Write  500 MB | Time: 0.550 s | Throughput: 909.03 MB/s<br>
Write 1024 MB | Time: 1.420 s | Throughput: 720.89 MB/s<br>

Received 5 MB | Time: 0.400 s | Throughput: 12.50 MB/s<br>
Received 30 MB | Time: 0.714 s | Throughput: 42.02 MB/s<br>
Received 100 MB | Time: 1.482 s | Throughput: 67.46 MB/s<br>
Received 200 MB | Time: 7.688 s | Throughput: 26.02 MB/s<br>
Received 500 MB | Time: 6.143 s | Throughput: 81.40 MB/s<br>
Received 1024 MB | Time: 12.755 s | Throughput: 80.28 MB/s<br>

Zakljucak: 
Razlika izmedju protoka clienta i servera je minimalna (0.08% - 2.58% | size >= 100 MB).
Razlika je drasticna za male velicine fajlova (5MB i 30MB) najverovatnije zbog TCP slow start algoritma i Client-Server Handshake-a

TCP slow start: https://www.keycdn.com/support/tcp-slow-start<br>
Handshake: https://www.geeksforgeeks.org/computer-networks/tcp-3-way-handshake-process/

VPN kompresija

U akademskom radu "Security Assessment and Evaluation of VPNs:A Comprehensive Survey" (https://dl.acm.org/doi/10.1145/3579162) govori se o mogucim bezbednosnim rizicima pri koriscenju kompresije podataka od strane VPN-ova (" If a VPN turns off compression, Voracle attack loses its grounds immediately. Therefore, it is suggested that VPNs do not compress traffic or at least keep compression optional for the user to decide.")

*OpenVPN* je zbog sigurnosnih razloga uveo opciju iskljucivanja kompresije podataka (iskljucena po defaultu)

*Cisco Secure VPN* takodje po defaultu iskljucuje kompresiju zbog sigurnosti (https://community.cisco.com/t5/security-knowledge-base/asa-best-practices-for-remote-access-vpn-performance/tac-p/4745280#toc-hId-1671604402) ali je predlaze samo kod WAN mreze male brzine. Koristi LZS algoritam kompresije (nezvanicno)

*NordVPN* takodje savetuje da se kompresija iskljuci zbog sigurnosti.
