package io.github.anpk.attendance;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

@SpringBootApplication
public class AttendenceAppApplication {

    public static void main(String[] args) {
        SpringApplication.run(AttendenceAppApplication.class, args);
        System.out.println("hello spring boot");
    }

}
