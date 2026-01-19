import java.io.*;
import java.net.*;
import java.security.MessageDigest;
import java.util.Random;

class TCPServer {

    public static void main(String[] args) throws Exception {

        TCPServer server = new TCPServer();

        server.WriteTest();
        Thread.sleep(10000);
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
        System.out.println("TCP RAM Server listening on port 5000...");

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

    /*public void ListenChecksum() throws Exception {

        ServerSocket serverSocket = new ServerSocket(Config.port);
        System.out.println("Checksum TCP Server listening on " + Config.port + "...");

        while (true) {

            Socket socket = serverSocket.accept();
            DataInputStream in = new DataInputStream(
                    new BufferedInputStream(socket.getInputStream()));

            System.out.println("Client connected.");

            while (true) {

                long size = in.readLong();

                if (size == -1) {
                    System.out.println("Session finished.\n");
                    break;
                }

                MessageDigest sha256 = MessageDigest.getInstance("SHA-256");

                byte[] buffer = new byte[Config.BUFFER_SIZE];
                long received = 0;

                long start = System.nanoTime();

                while (received < size) {
                    int toRead = (int) Math.min(buffer.length, size - received);
                    int bytesRead = in.read(buffer, 0, toRead);

                    if (bytesRead < 0)
                        throw new EOFException("Stream closed early");

                    sha256.update(buffer, 0, bytesRead);
                    received += bytesRead;
                }

                byte[] clientHash = new byte[32];
                in.readFully(clientHash);

                long end = System.nanoTime();

                byte[] serverHash = sha256.digest();

                double seconds = (end - start) / 1_000_000_000.0;
                double mb = received / (1024.0 * 1024.0);

                System.out.printf(
                        "Received %.0f MB | Time: %.3f s | Throughput: %.2f MB/s%n",
                        mb, seconds, mb / seconds
                );

                if (MessageDigest.isEqual(clientHash, serverHash))
                    System.out.println("CHECKSUM: OK\n");
                else
                    System.out.println("CHECKSUM: FAIL\n");
            }

            socket.close();
        }
    }

    static String bytesToHex(byte[] bytes) {
        StringBuilder sb = new StringBuilder();
        for (byte b : bytes)
            sb.append(String.format("%02x", b));
        return sb.toString();
    }*/
}