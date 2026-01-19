package io.github.anpk.attendanceapp;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

@SpringBootApplication
public class AttendanceAppApplication {

    public static void main(String[] args) {
        SpringApplication.run(AttendanceAppApplication.class, args);
        System.out.println("hello spring boot");
    }

}
