import java.io.*;
import java.net.*;
import java.util.Random;

class TCPClient {

    public static void main(String[] args) throws Exception {

        TCPClient client = new TCPClient();

        client.ReadTest();
        Thread.sleep(5000);
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

            Socket socket = new Socket("192.168.1.8", 5000);

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
}

