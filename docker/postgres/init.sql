-- Se ejecuta solo la primera vez que se crea el volumen.
-- Base separada para las pruebas automáticas de la API.
CREATE DATABASE zapadictos_test;

-- unaccent permite que la búsqueda ignore tildes ("nino" encuentra "niño").
\connect zapadictos
CREATE EXTENSION IF NOT EXISTS unaccent;

\connect zapadictos_test
CREATE EXTENSION IF NOT EXISTS unaccent;
