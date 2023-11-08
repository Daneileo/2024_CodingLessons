package hello;

public class Circle {
    private double      radius;
    static final double PI = 3.14;

    public Circle() {
        radius = 1;
    }

    public void setRadius(double r) {
        radius = r;
    }

    public double getRadius() {
        return radius;
    }

    public double getArea() {
        return PI * radius * radius;
    }


}