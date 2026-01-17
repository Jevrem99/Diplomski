public abstract class Config {

    public static final int BUFFER_SIZE = 8192;
    public static String path = "C:/Users/n.jevremovic/Desktop/Diplomski/PDF/";
    public static String[] PDFfiles ={"5mb.pdf","30mb.pdf","100mb.pdf","200mb.pdf","500mb.pdf","1gb.pdf"};
    public static final long[] sizes = {
            5L * 1024 * 1024,
            30L * 1024 * 1024,
            100L * 1024 * 1024,
            200L * 1024 * 1024,
            500L * 1024 * 1024,
            1L * 1024 * 1024 * 1024
    };
}
