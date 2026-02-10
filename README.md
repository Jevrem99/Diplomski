# Diplomski
Tema: _"Optimizacija prenosa podataka u racunarksim mrezama primenom kompresije"_

Klijent i server implementirani u 2 odvojena JAVA projekta.
I klijent i server mogu da mere vreme citanja(klijent) i pisanja(server) na disk.
Klijent salje random bitove serveru i oba mere propustnost mreze u MB/s

Server je hostovan na HOSTINGER-u.

| Server specs:| |
| ------ | ------ |
| Server location | Germany - Frankfurt |
| CPU core | 2 |
| Memory | 8 GB |
| Disk space | 100 GB |
| OS | Ubuntu 24.04 LTS |

U fajlu VPN test nalaze se podaci testiranja OpenVPN-a i Wireguard-a. Testovi su radjeni u tri kategorije:
- WIFI - Klijent je bezicno vezan za mrezu.
- LAN - Klijent i server su vezani LAN kablom za isti ruter.
- HOST - Server je hostovan. Klijent je vezan LAN kablom za ruter.

Testovi su ponavljani po 10 puta belezeci rezultate i sa klijenta i sa servera.
VPN je koriscen sa standardnim podesavanjima.

Za svaki VPN racunat je OVERHEAD - procenat usporenja mreze VPN-om.
Sudeci po Overhead rezultatima svi VPN protokoli uvode značajan pad performansi u odnosu na scenario bez VPN-a.
Negativan overhead se primecuje kod WIFI testova. Najverovatniji uzrok je nepouzdanost mreze.

| VPN | Average | MAX | MIN | MAX Overhead | MIN Overhead | 
| ------ | ------ | ------ | ------ | ------ | ------ |
| OpenVPN | 2.24 MB/s | 4.50 MB/s | 1.59 MB/s | 88.01 % | 62.24 % |
| Wireguard | 2.15 MB/s | 3.21 MB/s | 1.62 MB/s |  88.54 % | 73.08 % |

Standardna devijacija je u svim testovima najveca kod prenosa od 5 MB.
Manji transferi pokazuju veću varijaciju rezultata jer kratko traju i osetljiviji su na trenutne promene u mreži.