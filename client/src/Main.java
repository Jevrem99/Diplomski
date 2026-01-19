import java.io.*;
import java.net.*;
import java.security.MessageDigest;
import java.util.Random;

class TCPClient {

    public static void main(String[] args) throws Exception {

        TCPClient client = new TCPClient();

        client.ReadTest();
        Thread.sleep(10000);
        client.SendToServer();
    }

    public void ReadTest() throws Exception
    {
        byte[] buffer = new byte[Config.BUFFER_SIZE];

        for(String file: Config.PDFfiles)
        {
            long totalBytes = 0;

            long start = System.nanoTime();

            try(BufferedInputStream in = new BufferedInputStream(new FileInputStream(Config.path + file)))
            {
                int bytesRead;
                while((bytesRead = in.read(buffer)) != -1){
                    totalBytes += bytesRead;
                }
            }

            long end = System.nanoTime();

            double seconds = (end - start) / 1_000_000_000.0;
            double mb = totalBytes / (1024.0 * 1024.0);
            double throughput = mb/seconds;

            System.out.printf(
                    "File %-10s | Time: %.3f s | Throughput: %.2f MB/s%n",
                    file,seconds,throughput
            );
        }
    }

    public void SendToServer() throws Exception
    {
        byte[] buffer = new byte[Config.BUFFER_SIZE];
        new Random().nextBytes(buffer);

        for (long size : Config.sizes) {

            Socket socket = new Socket(Config.serverHost, Config.serverPort);

            BufferedOutputStream out =
                    new BufferedOutputStream(socket.getOutputStream());

            long sent = 0;

            long start = System.nanoTime();

            while (sent < size) {
                int toSend = (int) Math.min(Config.BUFFER_SIZE, size - sent);
                out.write(buffer, 0, toSend);
                sent += toSend;
            }

            out.flush();
            socket.close();

            long end = System.nanoTime();

            double seconds = (end - start) / 1_000_000_000.0;
            double mb = size / (1024.0 * 1024.0);

            System.out.printf(
                    "Sent %.0f MB | Time: %.3f s | Throughput: %.2f MB/s%n",
                    mb, seconds, mb / seconds
            );
        }
    }

    /*public void SendToServerChecksum() throws Exception
    {
        Socket socket = new Socket(Config.serverHost, Config.serverPort);

        DataOutputStream out =
                new DataOutputStream(new BufferedOutputStream(socket.getOutputStream()));

        byte[] buffer = new byte[Config.BUFFER_SIZE];
        new Random().nextBytes(buffer);

        MessageDigest sha256 = MessageDigest.getInstance("SHA-256");

        for (long size:Config.sizes) {
            out.writeLong(size);

            long sent = 0;
            long start = System.nanoTime();

            while (sent < size) {
                int toSend = (int) Math.min(Config.BUFFER_SIZE, size - sent);
                out.write(buffer, 0, toSend);
                sha256.update(buffer, 0, toSend);
                sent += toSend;
            }

            byte[] hash = sha256.digest();
            out.write(hash);

            out.flush();
            socket.close();

            long end = System.nanoTime();

            double seconds = (end - start) / 1_000_000_000.0;
            double mb = size / (1024.0 * 1024.0);

            System.out.printf(
                    "Sent %.0f MB | Time: %.3f s | Throughput: %.2f MB/s%n",
                    mb, seconds, mb / seconds
            );

            System.out.println("Client checksum: " + bytesToHex(hash));
        }
    }

    static String bytesToHex(byte[] bytes) {
        StringBuilder sb = new StringBuilder();
        for (byte b : bytes)
            sb.append(String.format("%02x", b));
        return sb.toString();
    }*/
    
}

