# TODO: Pin to digest for reproducible builds:
# docker pull eclipse-temurin:21-jre-alpine && docker inspect --format='{{index .RepoDigests 0}}' eclipse-temurin:21-jre-alpine
# FROM eclipse-temurin:21-jre-alpine@sha256:<digest>
FROM eclipse-temurin:21-jre-alpine
WORKDIR /app
COPY target/*.jar app.jar
EXPOSE 8281
ENTRYPOINT ["java", \
  "-XX:+UseContainerSupport", \
  "-XX:MaxRAMPercentage=75.0", \
  "-XX:+ExitOnOutOfMemoryError", \
  "-Djava.security.egd=file:/dev/./urandom", \
  "-jar", "app.jar"]
