public abstract class Config {

    public static final int BUFFER_SIZE = 8192;
    public static final String path = "C:/Users/jevre/Desktop/Diplomski/Write_test/";
    public static final long[] write_test_sizes = {
            5L * 1024 * 1024,
            30L * 1024 * 1024,
            100L * 1024 * 1024,
            200L * 1024 * 1024,
            500L * 1024 * 1024,
            1L * 1024 * 1024 * 1024
    };
    public static final int port = 5000;
}
