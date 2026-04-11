FROM eclipse-temurin:21.0.10_7-jre-alpine-3.23
# Apply latest Alpine security patches (CVE-2026-34757 libpng, CVE-2026-40200 musl)
RUN apk upgrade --no-cache
WORKDIR /app
COPY target/*.jar app.jar
EXPOSE 8289
ENTRYPOINT ["java", \
  "-XX:+UseContainerSupport", \
  "-XX:MaxRAMPercentage=75.0", \
  "-XX:+ExitOnOutOfMemoryError", \
  "-Djava.security.egd=file:/dev/./urandom", \
  "-jar", "app.jar"]
