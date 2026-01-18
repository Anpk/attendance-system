package io.github.anpk.attendance.controller;

import org.springframework.core.io.Resource;
import org.springframework.core.io.UrlResource;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.net.MalformedURLException;
import java.nio.file.Path;

@CrossOrigin(origins = "http://localhost:3000")
@RestController
@RequestMapping("/api/images")
public class ImageController {

    @GetMapping("/{filename}")
    public ResponseEntity<Resource> serveImage(@PathVariable String filename)
            throws MalformedURLException {

        String uploadDir = System.getProperty("user.dir") + "/uploads";
        Path filePath = Path.of(uploadDir, filename);

        Resource resource = new UrlResource(filePath.toUri());

        if (!resource.exists()) {
            return ResponseEntity.notFound().build();
        }

        return ResponseEntity.ok()
                .contentType(MediaType.IMAGE_JPEG) // png도 브라우저가 알아서 처리
                .body(resource);
    }
}
