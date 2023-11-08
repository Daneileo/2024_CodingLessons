package hello;

import java.util.Scanner;

public class HelloWithName {

    static Scanner scanner = new Scanner(System.in);

    public static void main(String[] varArgs) {

        System.out.println("What is your first name");

        String name = scanner.nextLine();

        System.out.println("Hello  " + name);

        System.out.println("What is you last name");


        String last = scanner.nextLine();


        System.out.println("Hello " + name + " " + last);

    }

}