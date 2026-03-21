package com.rstglobal.shield.location.config;

import org.springframework.amqp.core.TopicExchange;
import org.springframework.amqp.rabbit.connection.ConnectionFactory;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.amqp.support.converter.Jackson2JsonMessageConverter;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * RabbitMQ publisher configuration for shield-location.
 *
 * Declares the shared shield.events TopicExchange so this service
 * can publish geofence breach events to the event bus.
 * The exchange is declared as durable=true, autoDelete=false to match
 * the consumer-side declaration in shield-notification.
 */
@Configuration
public class RabbitMQConfig {

    public static final String EXCHANGE_NAME              = "shield.events";
    public static final String ROUTING_KEY_GEOFENCE_BREACH = "shield.geofence.breach";

    @Bean
    public TopicExchange shieldEventsExchange() {
        return new TopicExchange(EXCHANGE_NAME, true, false);
    }

    @Bean
    public Jackson2JsonMessageConverter messageConverter() {
        return new Jackson2JsonMessageConverter();
    }

    @Bean
    public RabbitTemplate rabbitTemplate(ConnectionFactory connectionFactory,
                                         Jackson2JsonMessageConverter messageConverter) {
        RabbitTemplate template = new RabbitTemplate(connectionFactory);
        template.setMessageConverter(messageConverter);
        return template;
    }
}
