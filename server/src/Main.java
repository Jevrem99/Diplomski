import java.io.*;
import java.net.*;
import java.security.MessageDigest;
import java.util.Random;

class TCPServer {

    public static void main(String[] args) throws Exception {

        TCPServer server = new TCPServer();

        //server.WriteTest();
        server.Listen();
    }

    public void WriteTest() throws Exception
    {
        new File(Config.path).mkdirs();

        byte[] buffer = new byte[Config.BUFFER_SIZE];
        new Random().nextBytes(buffer);

        for(long size:Config.write_test_sizes)
        {
            String filename = Config.path + "write_" + (size/(1024*1024)) + "MB.bin";

            long written = 0;

            long start = System.nanoTime();

            try(BufferedOutputStream out = new BufferedOutputStream(new FileOutputStream(filename))){

                while (written < size) {
                    int toWrite = (int) Math.min(Config.BUFFER_SIZE, size - written);
                    out.write(buffer, 0, toWrite);
                    written += toWrite;
                }

                out.flush();
            }

            long end = System.nanoTime();

            double seconds = (end - start) / 1_000_000_000.0;
            double mb = size / (1024.0 * 1024.0);
            double throughput = mb / seconds;

            System.out.printf(
                    "Write %4.0f MB | Time: %.3f s | Throughput: %.2f MB/s%n",
                    mb, seconds, throughput
            );
        }
    }

    public void Listen() throws Exception
    {
        ServerSocket serverSocket = new ServerSocket(5000);
        System.out.println("TCP Server listening on port " + Config.port + "...");

        while (true) {

            Socket socket = serverSocket.accept();

            BufferedInputStream in =
                    new BufferedInputStream(socket.getInputStream());

            byte[] buffer = new byte[Config.BUFFER_SIZE];
            long totalBytes = 0;

            long start = System.nanoTime();

            int bytesRead;
            while ((bytesRead = in.read(buffer)) != -1) {
                totalBytes += bytesRead;
            }

            long end = System.nanoTime();

            double seconds = (end - start) / 1_000_000_000.0;
            double mb = totalBytes / (1024.0 * 1024.0);

            System.out.printf(
                    "Received %.0f MB | Time: %.3f s | Throughput: %.2f MB/s%n",
                    mb, seconds, mb / seconds
            );

            socket.close();
        }
    }
}