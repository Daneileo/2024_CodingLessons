package hello;

public class HelloWorld {

    public static void main(String[] varArgs) {

        System.out.println("Hello World");
        Circle leo = new Circle();
        leo.setRadius(1);
        System.out.print(leo.getArea());
    }

}